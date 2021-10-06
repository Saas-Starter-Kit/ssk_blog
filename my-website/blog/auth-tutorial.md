---
title: React, Nodejs and Firebase complete authentication guide
description: A complete Authentication tutorial for integrating React and Nodejs with Firebase
slug: react-nodejs-firebase-auth
tags: [auth, firebase]
image: ../static/img/mick-haupt-U8mGmPDA-D8-unsplash.jpg
---

# React, Nodejs and Firebase Complete Authentication Guide

In this tutorial we will be going over a complete guide to authentication using React, nodejs and Firebase.

We will use Firebase to authenticate users but also save the user info in our own database and send a JWT token from our own server as well.

We will go through the entire signup and login process as well as saving the user info to local storage and silent authentication.

We will give the option for both 1-click Google Signup as well the traditional email signup.

<!--truncate-->

### Project Setup

Installing firebase

For the client we install

`npm install firebase`

server we need the server side firebase library

`npm install firebase-admin`

### Client Side

To start we can create a firebase project. To create a firebase project, simply go to the console page and click on the new project.

After creating a new project go to project settings and choose the web app option. After choosing the web app option you will get an API key. You will need the API key and firebase auth domain for the next step.

The firebase auth domain is simply name-of-project.firebaseapp.com. Substitute both of these for environment variables in your React Front end. Example:

## Firebase env vars

`FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`FIREBASE_AUTH_DOMAIN=example.firebaseapp.com`

Next we can configure the firebase object. Doing this is easy, we simply pass in the env variables to the `firebase.initializeApp()` function.

```
import firebase from "firebase/app"
import "firebase/auth"

const config = {
  apiKey: process.env.GATSBY_FIREBASE_API_KEY,
  authDomain: process.env.GATSBY_FIREBASE_AUTH_DOMAIN,
}

if (!firebase.apps.length) {
  firebase.initializeApp(config)
}

export const firebaseApp = firebase
```

We also have to make sure only one firebase app is initialized so we wrap the initalizeApp() call in a function. Finally we just export firebase.

### Server Side

Setting up firebase on the server is very easy. The server uses the firebase admin sdk which just expects a GOOGLE_CLOUD_PROJECT env variable to have the name of the project and thats it. The firebase admin sdk is now setup.

`GOOGLE_CLOUD_PROJECT=example1`

## Signup

### Client

The first part will be the Signup process.

First we our signup form. The css of the form is not important. What is crucial is that we have 2 fields that a user can enter an email and password. We also have an option for 1 click Google sign up.

```
 <form onSubmit={handleSubmit}>
              <Label htmlFor="email">Email:</Label>
              <InputWrapper>
                <Input
                  type="email"
                  name="email"
                  id="email"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.email}
                />
              </InputWrapper>

              <Label htmlFor="username">First and Last Name:</Label>
              <InputWrapper>
                <Input
                  type="text"
                  name="username"
                  id="username"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.username}
                />
              </InputWrapper>

              <Label htmlFor="password">Password:</Label>
              <InputWrapper>
                <Input
                  type="password"
                  name="password"
                  id="password"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.password}
                />
              </InputWrapper>

              <Button type="submit">SignUp</Button>
            </form>

     <GoogleButton GoogleSignin={GoogleSignin} />

```

Next we have our handleSubmit() function that handles the password and email values. We simply need to pass on the email and password to the firebase createUser function.

We also received a username which we will use next.

```
  const handleSubmit = async (values) => {

    let email = values.email;
    let password = values.password;
    let username = values.username;

    let authRes = await firebase
      .auth()
      .createUserWithEmailAndPassword(email, password)
      .catch((error) => {
        fetchFailure(error);
      });

    SignupAuth(authRes, firebase, username);
  };
```

Next we have GoogleSignin function which is similar.

```
  //Google OAuth2 Signin
  const GoogleSignin = async () => {
    let provider = new firebase.auth.GoogleAuthProvider();

    //wait for firebase to confirm signup
    let authRes = await firebase
      .auth()
      .signInWithPopup(provider)
      .catch((error) => {
        fetchFailure(error);
      });

    SignupAuth(authRes, firebase);
  };
```

Upon successful authentication Firebase will return a response that contains user information and an id token. We will then take this information and save it to our own database.

Now we can look at the signupAuth function which contains all the business logic for authenticating users during signup.

```
export const SignupAuth = async (
  authRes,
  firebase,
  name,
) => {
  // If user signed up with email, then set their display name
  const isEmailSignup = authRes.additionalUserInfo.providerId === 'password';
  console.log(isEmailSignup);
  if (isEmailSignup && name) {
    let curUser = await firebase.auth().currentUser;

    await curUser
      .updateProfile({
        displayName: name
      })
      .catch((err) => {
        fetchFailure(err);
      });
  }

  //Get Auth id token from Firebase
  let token = await firebase
    .auth()
    .currentUser.getIdToken()
    .catch((err) => {
      fetchFailure(err);
    });

  //server firebase authentication, returns jwt token
  let username = authRes.user.displayName ? authRes.user.displayName : name;
  let email = authRes.user.email;

  let authData = { email, username, token };
  let authServerRes = await axios.post(`/auth/signup`, authData).catch((err) => {
    fetchFailure(err);
  });

  //extract user id from jwt token
  let jwt_token = authServerRes.data.token;

  let userId = validToken.user;
  let username = authRes.user.displayName;
  let id = userId;
  let photo = authRes.user.photoURL;
  let provider = authRes.user.providerData[0].providerId;


  let user = {
    email,
    username,
    id,
    photo,
    provider,
    jwt_token
  };

   LogIn(user)
};

```

First we check to see if the user signed up with email. If so, we can set the the user displayName property in firebase. The Google sign in already contains the username so we don’t have to do anything for that.

Then we get the id token from the firebase auth response. This will be used by the firebase admin on the server to further authenticate the user.

We make an api request to the server with the given information to save it in our own database.

We will see the server code next.

The `LogIn()` function is an action creator that saves user info to local storage, we will see how to set this up after the login.

### Server

```
export const SignUp = async (req, res) => {
  let token = req.body.token;
  let username = req.body.username;
  let email = req.body.email;

  //First Check if User exists
  let userExists = await getUser(email);

  //If user exists send error message, otherwise continue code
  if (userExists) {
    res.status(400).send({ type: 'Failed Sign Up', message: 'User Already Exists' });
    return;
  }

  //decode the firebase token received from frontend and save firebase uuid
  let decodedToken = await firebaseAdmin.auth().verifyIdToken(token);

  let firebaseId = decodedToken.user_id;

  //save user firebase info to our own db, and get unique user database id
  let result = await saveUsertoDB(email, username, firebaseId);
  console.log(result);

  let userId = result.id;


  res.send({ token: setToken(userId) });
};

```

We are doing a basic check to see if the user already exists in our database. If not we we save the user to our database. firebase.verifyToken() is used to make sure this is the right user. The id token is the same one from our frontend.

If all is successful we return a JWT token.

## Login

We will skip the form since it will be the same except for a username field.

```
  const handleSubmit = async (values) => {

    let email = values.email;
    let password = values.password;

    let authRes = await firebase
      .auth()
      .signInWithEmailAndPassword(email, password)
      .catch((error) => {
        fetchFailure(error);
      });

    LoginAuth(authRes, LogIn, firebase);
  };

  //Google OAuth2 Signin
  const GoogleSignin = async () => {
    fetchInit();
    let provider = new firebase.auth.GoogleAuthProvider();

    let authRes = await firebase
      .auth()
      .signInWithPopup(provider)
      .catch((error) => {
        fetchFailure(error);
      });

    LoginAuth(authRes, LogIn, firebase);
  };

```

This is similar to our signup functions except we are signing in instead of creating a user.

Now for our LoginAuth() which contains the business logic.

```
export const LoginAuth = async (
  authRes,
  LogIn,
  firebase,
) => {
  //Get Auth id token from Firebase
  let token = await firebase
    .auth()
    .currentUser.getIdToken()
    .catch((err) => {
      fetchFailure(err);
    });

  //server firebase authentication, returns jwt token
  let email = authRes.user.email;
  let data = { email, token };
  let authServerRes = await axios.post(`/auth/login`, data).catch((err) => {
    fetchFailure(err);
  });

  let validToken = isValidToken(authServerRes.data.token, fetchFailure);
  let userId = validToken.user;
  let jwt_token = authServerRes.data.token;



  let username = authRes.user.displayName;
  let id = userId;
  let photo = authRes.user.photoURL;
  let provider = authRes.user.providerData[0].providerId;


  let user = {
    email,
    username,
    id,
    photo,
    provider,
    jwt_token
  };


  //save user info to React context
  await LogIn(user);

};

```

We do a similar process and we get the id token then send the email and token to our server so we can get our own jwt token. We also save all the info to context similar to the signup.

Now for our server code

```
export const Login = async (req, res) => {
  let token = req.body.token;
  let email = req.body.email;

  //decode the firebase token received from frontend
  let decodedToken = await firebaseAdmin.auth().verifyIdToken(token);

  let firebaseId = decodedToken.user_id;

  //Check if User exists
  let user = await getUser(email);

  //If user not found send error message
  if (!user) {
    //delete user from firebase
    res.status(400).send({ type: 'Failed Login', message: 'User Does Not Exists' });
    return;
  }

  let user_id = user.id;

  res.send({ token: setToken(user_id)});
};

```

On the server we first verify the id token. Then we check if the user exists. If yes we continue the code and send a jwt token. If the user does not exist we send an error message.

Context and Auth Reducer and saving user info to local storage.
Now we can look at how we save the user info to local storage. We will use the reducer actions style of managing and updating state for this, along with the useReducer hook.

We can start off with our actions

```
export const Login = (user) => {
  return {
    type: “LOGIN”,
    payload: user
  };
};

export const Logout = {
  type: “LOGOUT”
 };

```

Now for our reducer.

```
import { LOGIN, LOGOUT } from "../actions/actionTypes"

export const initialStateAuth = {
  isAuthenticated: false,
  user: null,
}

export const authReducer = (state, action) => {
  switch (action.type) {
    case “LOGIN”:
      let user = action.payload
      //set 10 hour expires time
      let expiresIn = 36000000 * 1000 + new Date().getTime()

      localStorage.setItem("expiresIn", JSON.stringify(expiresIn))
      localStorage.setItem("user", JSON.stringify(user))

      return { isAuthenticated: true, user: user }
    case “LOGOUT”:
      localStorage.removeItem("expiresIn")
      localStorage.removeItem("user")
      return { ...state, isAuthenticated: false, user: null }
    default:
      return state
  }
}
```

The initial state is that the user is not logged in and not authenticated. If the type is login we get the user info which we saw was passed down in the payload of the LOGIN action creator. We then simply save this info to local storage. And we do the opposite for logouts.

Now to actually use the reducer we need to pass it in for the useReducer() hook like so. Define this in the Root Parent component of your app.

```
  const [authState, dispatchAuth] = useReducer(authReducer, initialStateAuth);
```

This will give use the user object in the authState object and we can dispatch actions in using dispatchAuth(). So our LogIn function can look like this. Note that Login being passed to dispatchAuth is the action creator we defined in the previous step.

```
  const LogIn = (user) => {
    dispatchAuth(Login(user));
  };

```

Then we pass this function in the context so it is available globally.

```
    <AuthContext.Provider value={{ authState, LogIn }}>
        {children}
    </AuthContext.Provider>
```

Just as a refresher context can be created in React like so.

```
import React from 'react';

const AuthContext = React.createContext();

export default AuthContext;
```

Coming full circle we assess the LogIn function like so in our Login and Signup pages.

` const { LogIn } = useContext(AuthContext);`

And this is it for the entire auth flow in React, nodejs and firebase. Next we will see one final piece of authentication.

## Silent Auth

Silent authentication is something that is seen in most apps. Usually a user should not be asked to login every single time they visit the site.

So we can log them in the background using a process called silent auth.

This is easy to do since all the user info and expires time should be saved in local storage.

```
export const silentAuth = (LogIn, LogOut) => {
  let user, expiresAt;

  user = JSON.parse(localStorage.getItem('user'));
  expiresAt = JSON.parse(localStorage.getItem('expiresIn'));

  if (user && new Date().getTime() < expiresAt) {
    LogIn(user);
  } else if (!user || new Date().getTime() > expiresAt) {
    LogOut();
  }
};
```

The LogIn function is the same action creator we saw and is passed down as a parameter to the function.

Then simply call the silentAuth() function in a useEffect() hook in the root parent component.

```
  useEffect(() => {
    silentAuth(LogIn, LogOut);
  }, []); // eslint-disable-line
```
