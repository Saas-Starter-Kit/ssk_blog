---
title: Roles and Permissions with React and Nodejs
description: A complete tutorial for setting up Roles and Permissions with React, Casljs and Nodejs with Firebase
slug: react-nodejs-roles-and-permissions
tags: [roles, permissions]
image: ../static/img/mick-haupt-U8mGmPDA-D8-unsplash.jpg
---

# Roles and Permissions Tutorial

Roles and permissions are a vital part of building web apps. Roles and permissions functionality are found in many web apps both big and small.

In this tutorial we will go over a complete guide on how to set up roles and permissions in a React and nodejs app. We will start with client side setup, then server side setup and finally we will see how both work together.

Since we need to set up roles and permissions on both client and server, we can use the casl library. This library is isomorphic, meaning it works seamlessly on both client and server which is perfect for our use case.

<!--truncate-->

https://casl.js.org/v5/en/

Before starting lets install the casl library. We will be using version 5 for this tutorial.

`npm install @casl/ability`

### Background Info

In a lot of apps there are usually 2 roles: admin and user. Roles can be anything you like. Owner, moderator and manager roles are also common. But admin and user roles would be the minimum.

Each role has certain permissions that define what the role can and cannot do. For example delete or edit another user’s post.

A common pattern when setting up permissions is to give the admin all permissions by default and then selectively remove certain permissions and do the opposite for the user role. Where the user is given no permissions by default and has permissions selectively added.

It is important to understand that roles and permissions do not exist in isolation. There needs to be an admin or user of something. In most web applications this is an “App”, “Project” or “Organization”.

It is also important to note that not every part of your app even needs roles and permissions functionality.

For example all users should have full access over their account settings. There should not be a need to add any permissions functionality here. Putting an admin role over a user in account settings would be redundant and unnecessary. So it is important to only use this where required.

### Client

We will begin on the client side. The very first thing we need to do is setup the casl context file. We can do so as seen below:

```
//caslContext.js
import { createContext } from 'react';

const CaslContext = createContext();

export default CaslContext;
```

Now we can setup the casl ability file that holds all the business logic and defines the roles and permissions.

```
//caslAbility.js
import { AbilityBuilder, Ability } from '@casl/ability';

const roleRules = (can, role, cannot) => {
  if (role === 'admin') {
    //admin has global privileges
    can('manage', 'all');
    cannot('read', 'user', 'password');
  } else if (role === 'user') {
    can('read', 'post');
    can('read', 'article', ['title', 'description']);
    can('read', 'user', 'password');
  }
};

export const defineRulesFor = (role) => {
  const { can, rules, cannot } = new AbilityBuilder(Ability);

  roleRules(can, role, cannot);

  return rules;
};

export const buildAbilityFor = (role) => {
  return new Ability(defineRulesFor(role));
};

export const updateRole = (ability, role) => {
  const { can, rules, cannot } = new AbilityBuilder();

  roleRules(can, role, cannot);

  ability.update(rules);
};

let defaultRole = null;

export const ability = buildAbilityFor(defaultRole);
```

`RolesRules()` holds the roles and permissions. We use can() and cannot() to give the permissions to each role. The can() and cannot() functions are coming from casl’s ability builder class.

`defineRulesFor()` is used to define the roles nad permissions where buildAbilityFor() actually creates the values.

We will see updateRole in a later section, but it does exactly as its name suggests.

Finally a default role is required and we pass in null. The final ability variable will be used in the next section where we pass it to the caslContext.

In the root parent component import the ability variable and casl context.

```
import CaslContext from './caslContext';
import { ability } from './caslAbility';

And wrap the parent component like so


….

  <CaslContext.Provider value={ability}>
	<RootParentComponent />
  </CaslContext.Provider>

….
```

For the final step of setting up casl on the client we need to create a Can component. In a separate file create the the Can component like so

```
//can.js
import { createContextualCan } from '@casl/react';
import CaslContext from '../utils/caslContext';

const Can = createContextualCan(CaslContext.Consumer);

export default Can;
```

This is it for the client we now setup on the server and then after that we can see how to use casl.

### Server

Our server setup is going to look similar to our front end setup. We can first define the casl configuration file

```
//permissions.js
import { AbilityBuilder, Ability } from '@casl/ability';

const roleRules = (can, role, cannot) => {
  if (role === 'admin') {
    //admin has global privileges
    can('manage', 'all');
    cannot('read', 'user', 'password');
  } else if (role === 'user') {
    can('read', 'post');
    can('read', 'article', ['title', 'description']);
    can('read', 'user', 'password');
  }
};

export const defineRulesFor = (role) => {
  const { can, rules, cannot } = new AbilityBuilder(Ability);

  roleRules(can, role, cannot);

  return rules;
};

export const buildAbilityFor = (role) => {
  if (role) {
    return new Ability(defineRulesFor(role));
  } else {
    return new Ability(defineRulesFor({}));
  }
};
```

We have the same functions from the front end but we also account for api requests with no role.

SInce this is nodejs and we are using express, our permissions will be handled with middleware. The code is as follows:

```
import { buildAbilityFor } from '../Config/permissions.js';

export const createPermissions = (req, _, next) => {
  let role = req.body.role || req.query.role || null;
  req.ability = buildAbilityFor(role);
  next();
};

export const requirePermissions = (req, res, next) => {
  let userAction = req.body.userAction || req.query.userAction;
  let subject = req.body.subject || req.query.subject;

  if (!req.ability.can(userAction, subject)) {
    let error = {
      type: '403 Forbidden',
      message: 'User does not have access to this resource'
    };

    res.status(403).send(error);
  } else {
    next();
  }
};
```

We have 2 middleware functions for our permissions.

`createPermissions()` initially creates the permissions, we receive the role in the body or query params and then build the abilities for the role. This is the same as we did on the frontend.

Next we save the built abilities in req.ability

`requirePermissions()` middleware checks the permissions. The casl action and subject also have to be included with the request. The action and subject as passed to the `can()` function on req.ability object we set up with `createPermissions()`

This is actually it for the server set up. We can now see an example of an api request from a React frontend to a nodejs server with permissions.

### Frontend Form

Here is a form for demonstration. It is wrapped in the Can component we setup in the beginning section. In the Can component. The “I” prop signifies the user action such as “submit” and the “a” prop signifies the subject such as “request”.

```
<Can I=”submit” a=”request”>
<form onSubmit={apiPermission}>
                <InputWrapper>
                  <FieldLabel htmlFor="userAction">User Action</FieldLabel>
                  <TextInput type="text" name="userAction" placeholder="read" />
                </InputWrapper>
                <InputWrapper>
                  <FieldLabel htmlFor="subject">Subject</FieldLabel>
                  <TextInput type="text" name="subject" placeholder="password" />
                </InputWrapper>
                <Button>Submit</Button>
              </form>
</Can>


  const apiPermission = async (event) => {
    event.preventDefault()

    //api for permission routes
    let role = isAdmin ? 'admin' : 'user';
    let userAction = event.target.userAction.value;
    let subject = event.target.subject.value;

    let data = { role, userAction, subject };

    //role, userAction and subject object keys are expected
    //for permission api requests
    let result = await axios.post('/private/permissions', data).catch((err) => {
      fetchFailure(err);
    });

    };

```

After the form we have the logic for the api request. Remember we need to include the role, user action and subject in the api request.

### Server Side

Now on our server we start with the api endpoint

```
app.use(createPermissions);

router.post('/private/permissions', requirePermissions, asyncHandler(privateRoute));
```

Notice we createPermissions in a global middleware and requirePermissions as a middleware in only the endpoint, this is because not every api request requires permissions.

Our api request can send back some simple data

```
export const privateRoute = (req, res) => {
  res.status(200).send('Accessed Private Endpoint');
};
```

And this is it for setting up roles and permission in react and nodejs. Let me know your thoughts in the comments.
