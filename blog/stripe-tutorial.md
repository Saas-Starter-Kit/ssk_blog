---
title: Stripe Subscriptions tutorial with React and Nodejs
description: A complete tutorial for setting up stripe subscriptions with React and Nodejs with Firebase
slug: react-nodejs-stripe-setup
tags: [stripe, subscriptions]
image: ../static/img/mick-haupt-U8mGmPDA-D8-unsplash.jpg
---

# Stripe Subscriptions with React and Nodejs

This will serve as a comprehensive guide to anyone looking for a complete and total guide for creating subscriptions in stripe. We will walk through each step from the frontend to the database.

The tech stack used will be React, nodejs and Postgres.

<!--truncate-->

### Create customer

The first thing we will need to do is to create a stripe customer. There are several places in your project where you can create the stripe customer. I prefer to just create the stripe customer right after the user is created in the database. There is no cost or disadvantage associated with this.

Another place to create the customer can be when a user enters the payment flow. The only thing with this is it adds an extra step to the payment process and another point of failure. I prefer to keep the payment process as frictionless as possible, but given the code below you can choose where in your project the stripe customer is created. The only assumption is your user already exists in your database.

With that out of the way we can get to the code.

The first thing we will look at is the api request associated with creating a customer that is called from the frontend. This assumes the userId is the unique id associated with this user that is stored in your database. In postgres this will be the primary key in the users table.

```
    let stripeApiData = { userId, email };
    let stripeServerRes = await axios
      .post('/stripe/create-customer', stripeApiData)
      .catch((err) => {
        fetchFailure(err);
      });

```

Now we can look at the nodejs server code.

We can also save the unique user id as metadata to the stripe customer. This will provide a relationship between the stripe customer and the user saved in our database.

```
export const CreateCustomer = async (req, res) => {
  let email = req.body.email;
  let userId = req.body.userId;

  //check if stripe customer already exists
  const existingCustomers = await stripe.customers.list({
    email
  });

  //if stripe customer exists send error message
  if (existingCustomers.data.length != 0) {
    res.status(400).send({ type: 'Failed Stripe Sign Up', message: 'User Already Exists' });
    return;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      databaseUID: userId
    }
  });

  //save stripe id to our own db
  let result = await createCustomerModel(customer, email);


  //send jwt token for user auth requests
  let token = setToken(userId);

  res.send({ stripe: result, token });
};



export const createCustomerModel = async (customer, email) => {
  let text = `UPDATE users SET stripe_customer_id=$1
              WHERE email=$2
              RETURNING stripe_customer_id`;
  let values = [customer.id, email];

  //save stripe customer id to database
  let queryResult = await db.query(text, values);

  return queryResult.rows[0];
};

```

To break down what this code is doing. We are first getting the database userid and the user email from our frontend.

We are then checking to see if the user already exists in our stripe account.
Stripe does not check the uniqueness of emails. So you will not get an error if you create multiple stripe customers with the same exact email. This is an obvious problem that we need to address. If the customer exists we return an error message to the frontend. If not we continue the code.

`stripe.customers.create()` is the actual function we use to create and save the stripe customer to our stripe account. When calling the create customer function, stripe will also return a unique stripe customer.

We will need to get and save this unique id in order to create a relationship between the stripe customer and user in our own database. In the same way we saved our own unique database id to stripe, we can save the stripe unique id to the database.

The code to that is in the createCustomerModel() function which is a postgres SQL query that saves the stripe id as a field on our users table.

This is it for creating a stripe customer and associating them with a user in our own database. Next we will look at how the entire checkout process for creating a subscription.

### Check Auth

The first step in creating a subscription with Stripe is to make sure your user is logged in. Creating a subscription for an unauthenticated user does not make sense. Therefore it is important to check the users auth status.

Also important to check is whether or not the user already has a subscription. Stripe does not check for multiple subscriptions. So without checking for this the user would get double charged.

Here is the code we can use to check for this.

```
  useEffect(() => {
    if (authState.user) {
      if (authState.user.subscription_id) {
        navigate('/subscriptionexists');
      } else if (authState.isAuthenticated) {
        navigate('/purchase/plan');
      }
    }
  }, [authState]);
```

In the first conditional check we check to see if there is even a user object. If yes we move on to the next 2 checks.

The first check is to see if there is an existing subscription if yes we navigate to a subscription exists page that informs them that they already have a subscription and to navigate to the subscription settings to update it. We will see how to update subscriptions in a later section.

If the user is not authenticated we show a login and signup page to the user.

If the user is authenticated and does not have subscription we navigate them to the Plan selecting screen which we will go over next.

### Select Plan

Before the checkout process the user needs to select the plan type they want. It is best to save the price id to an environment variable. It is possible to retrieve the plans with an API call, but seeing how infrequently subscription prices change this is a waste and unnecessary.

Also important to note that we need the price id and not the product id. So the key will be price_xxxxxx not prod_xxxxxxx.

```
  const premium_type = process.env.GATSBY_STRIPE_PREMIUM_PLAN_TYPE;
  const basic_type = process.env.GATSBY_STRIPE_BASIC_PLAN_TYPE;

  const [plan, setPlan] = useState(basic_plan);
```

The user chosen plan type should be saved to the local state. When the user submits they are actually clicking on a Link element that will take them to the checkout page. The plan id can be passed as a state prop to the Link element, this will allow us to easily access the plan id in the checkout page.

```
        <Link
          to="/purchase/payment"
          state={{ plan }}
        >
          <PlanButton>Submit</PlanButton>
        </Link>
```

### Checkout

We can now start on the checkout page which will be the most complex part of implementing subscriptions.

The very first thing we will need to do is wrap the checkout page in the Stripe Elements component. This will allow the Stripe hooks to be used in the child component which we will see next. The stripeConfig is the same one we set up at the beginning.

```
      <Elements stripe={stripeConfig}>
        <CheckoutForm />
      </Elements>

...
```

We first need to define the useElements() and useStripe() hooks. Also we need the <CardElement /> jsx component. All these are directly imported from stripe. All these elements will be used in the next section.

```
…

  const stripe = useStripe();
  const elements = useElements();

…

  <form onSubmit={addPaymentMethod}>
            <CardElement />
            <ButtonWrapper>
              <Button type="submit" disabled={!stripe}>
                Add Card
              </Button>
            </ButtonWrapper>
          </form>

...
```

The next thing we will need to do is allow the user to enter in their payment method. This will be through the form we defined above.

We can now look at the frontend code which allows a user to add a payment method.

```

  const addPaymentMethod = async (event) => {
    event.preventDefault();

    let data = { customer: authState.user };
    //get stripe client secret
    const result = await axios.post('/stripe/wallet', data).catch((err) => {
      fetchFailure(err);
    });

    const cardElement = elements.getElement(CardElement);

    //validate customer card
    const { setupIntent, error } = await stripe
      .confirmCardSetup(result.data.client_secret, {
        payment_method: { card: cardElement }
      })
      .catch((err) => {
        fetchFailure(err);
      });

    if (!setupIntent && error) {
      fetchFailure(error);
    } else if (!setupIntent && !error) {
      let error = {
        type: 'Stripe Confirmation Error',
        message: 'Stripe Confirmation Failed, Please contact support'
      };
      fetchFailure(error);
    }


    setPaymentMethod(setupIntent.payment_method);

  };

```

We first need a setup intent client secret. The setup intent is used by stripe to keep track of the entire payment process so we will need to retrieve first from our server at the “stripe/wallet” api endpoint. We will see the code for this next.

The card info is also available in the elements hook we defined previously. We take that card info and the setup intent we got from our server and call stripe’s `confirmCardSetup()` function which verifies if the card information is valid.

If the card is valid we continue the code if not we show an error message.

Finally we save the payment method to our local state.

Here is the server code to create a setupIntent, we simply take the stripe customer id and pass it into the setupIntents.create() function.

```
export const CreateSetupIntent = async (req, res) => {
  let customer_id = req.body.customer.stripeCustomerKey;

  const setupIntent = await stripe.setupIntents.create({
    customer: customer_id
  });

  res.send(setupIntent);
};
```

### Create subscription

Now that a user has added a payment method we can create the subscription. We will start with the front end code.

```

  const createSubscription = async () => {


    let payment_method = paymentMethod;
    let customer = authState.user;
    let planSelect = plan;

    let data = { payment_method, customer, planSelect };

    //create subscription
    let result = await axios.post('/stripe/create-subscription', data).catch((err) => {
      fetchFailure(err);
    });

    if (result.data.status === 'active' || result.data.status === 'trialing') {
      navigate('/purchase/confirm');
    } else {
      let error = {
        type: 'Stripe Confirmation Error',
        message: 'Stripe Confirmation Failed, Please contact support'
      };
      fetchFailure(error);
    }
  };
```

The paymentMethod is the same one we saved to the local state in the last step. The planSelect is the selected plan the user choose in the plan page. The authState user object is the user data from our database.

We send this data to our api endpoint which we will see next. The api endpoint will return a subscription object that contains a status object that will be either trailing or active if the subscription was created successfully.

```
export const CreateSubscription = async (req, res) => {
  let customer_id = req.body.customer.stripeCustomerKey;
  let payment_method = req.body.payment_method;
  let email = req.body.customer.email;
  let price = req.body.planSelect;

  // Attach the  payment method to the customer
  await stripe.paymentMethods.attach(payment_method, { customer: customer_id });

  // Set it as the default payment method for the customer account
  await stripe.customers.update(customer_id, {
    invoice_settings: { default_payment_method: payment_method }
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer_id,
    items: [{ price }],
    default_payment_method: payment_method,
    trial_period_days: 14
  });

  let subscriptionId = subscription.id;

  if (subscription.status === 'succeeded' || subscription.status === 'trialing') {
    //update db to users subscription
    createSubscriptionModel(email, subscriptionId);

    res.send(subscription);
  } else {
    //if subscription fails send error message
    res
      .status(400)
      .send({ type: 'Stripe Purchase Error', message: 'Stripe Server Side Purchase Failed' });
    return;
  }
};

export const createSubscriptionModel = async (email, subscriptionId) => {
  let text = `UPDATE users SET is_paid_member=$1, subscription_id=$3
                WHERE email = $2`;
  let values = ['true', email, subscriptionId];

  await db.query(text, values);

  return;
};
```

We will first need to attach the payment method the user added on the frontend in order to allow us to do recurring charges for this customer.

Then we call stripe’s subscriptions.create() function to create the subscription with all the data. We can then retrieve the subscription id from the created subscription and save it to our database. This will allow us to create a relationship between our database user and the stripe subscription.

And this is it for the checkout page. If all goes successfully we can redirect the user to a confirm page.

### Confirm Payment

There is no stripe code here. This should just be a simple page that informs the user that their subscription has been confirmed.

You can generally redirect the user to the app after this point.

### Update subscription

We are not yet done however. There is still the matter of updating and canceling subscriptions since subscriptions never go on indefinitely.

We do not need to implement updating subscriptions completely from scratch. We can reuse the entire payment flow we just implemented and just call a different function if a user is upgrading instead of creating a subscription.

We can simply set an isUpgradeFlow flag as a query parameter and then call either the updateSubscription() function if it's true.

```
…


      let isUpgradeFlow = location.state.isUpgradeFlow;

….

        <Button
          disabled={!paymentMethod}
          onClick={isUpgradeFlow ? updateSubscription : createSubscription}
        >
          Confirm
        </Button>

…
```

Now for our frontend `updateSubscription()` function.

```
  const updateSubscription = async () => {

    let subscriptionId = subscription_id;
    let planSelect = plan;
    let payment_method = paymentMethod;
    let subscriptionItem = subscription_item;
    let email = authState.user.email;

    let data = { subscriptionId, planSelect, payment_method, subscriptionItem, planType, email };

    await axios.put('/stripe/update-subscription', data).catch((err) => {
      fetchFailure(err);
    });

    navigate('/purchase/confirm');
  };
```

There should be an existing subscription id saved and associated with the user in the database and it should be set here.

We then call the api endpoint with our data.

```
export const UpdateSubscription = async (req, res) => {
  let subscription_id = req.body.subscriptionId;
  let payment_method = req.body.payment_method;
  let price = req.body.planSelect;
  let id = req.body.subscriptionItem;
  let planType = req.body.planType;
  let email = req.body.email;

  const subscription = await stripe.subscriptions.update(subscription_id, {
    default_payment_method: payment_method,
    items: [{ id, price }]
  });


  res.status(200).send(subscription);
};
```

Updating subscriptions is relatively simple. We just pass all our data from our frontend to stripe’s subscriptions.update() function which updates our users subscription plan.

### Cancel Subscription

A user should also be able to cancel the subscription. We will as usual start with the frontend

```
  const cancelSubscription = async () => {

    let data = {
      email: authState.user.email
    };

    await axios.post('/stripe/cancel-subscription', data).catch((err) => {
      fetchFailure(err);
    });
  };
```

We are as usual making an API request to the server with the required information. We will make an api request with only the email instead of passing the subscription. We will do to prevent any malicious tampering and get the subscription id server side. Now for our server side code.

```
export const CancelSubscription = async (req, res) => {
  let email = req.body.email;

  //check if user exists
  const user = await getUser(email);

  let subscription_id = user.subscription_id;

  //delete subscription and send back response
  const subscription = await stripe.subscriptions.del(subscription_id);

  if (subscription.status === 'canceled') {
    //update our own db for canceled subscription
    await cancelSubscriptionModel(email);


    res
      .status(200)
      .send({ type: 'Request Successful', message: 'Subscription Successfully Canceled' });
  } else {
    res.status(400).send({
      type: 'Subscription Cancel Failed',
      message: 'Subscription Cancel Failed, please contact support'
    });
  }
};




export const cancelSubscriptionModel = async (email) => {
  let text = `UPDATE users SET is_paid_member=$1, subscription_id=$2
              WHERE email=$3`;
  let values = ['false', '', email];

  await db.query(text, values);

  return;
};

```

As mentioned we are simply getting the user server side and then calling stripe’s `subscriptions.del()` method.

We also update our own database to reflect the canceled subscription. We set a is_paid_member column to false and then remove the subscription id.

Finally we send a confirmation back to our frontend.
