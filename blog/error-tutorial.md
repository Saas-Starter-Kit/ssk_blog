---
title: React, Nodejs Error Handling
description: A complete tutorial for handling errors in React and Nodejs
slug: react-nodejs-error-handling
tags: [error handling]
image: ../static/img/mick-haupt-U8mGmPDA-D8-unsplash.jpg
---

Proper error handling is critical in web apps. Error handling is generally used to inform your users that an error has occurred and next steps. Next steps for users generally are to reload the page to try again or to contact support.

Most errors are asynchronous since synchronous errors are very easy to catch during development.

So this tutorial will be focused on async errors. We also want to integrate loading states with this as well since api requests are usually done with a loading screen.

In this tutorial we will go over centralizing this error handling process in a React app.

We want all the components and views in our app to have access to this error handling so we can pass it down through Context. Since we are using Context we can also use the action Reducer style of updating state.

<!--truncate-->

We first create the Context object like so:

```
import React from 'react';

const ApiContext = React.createContext();

export default ApiContext;
```

Next we define our actions

```
export const Fetch_init = {
  type: “FETCH_INIT”
};

export const Fetch_failure = (error) => {
  return {
    type: “FETCH_FAILURE”,
    payload: error
  };
};
export const Fetch_success = {
  type: “FETCH_SUCCESS”
};
```

We have 3 possible action types for handling async api requests. The first is to start the request, next is if it fails and the last is if it succeeds.

Next our reducer

```
import { FETCH_FAILURE, FETCH_INIT, FETCH_SUCCESS } from '../actions/actionTypes';
import { apiErrorHandler } from '../../utils/helpers';

export const initialStateApi = {
  isLoading: false
};

export const apiReducer = (state, action) => {
  switch (action.type) {
    case “FETCH_INIT”:
      return {
        ...state,
        isLoading: true
      };
    case “FETCH_SUCCESS”:
      return {
        ...state,
        isLoading: false
      };
    case “FETCH_FAILURE”:
      let error = action.payload;

      apiErrorHandler(error);

      return {
        ...state,
        isLoading: false
      };
    default:
      return {
        ...state,
        isLoading: false
      };
  }
};
```

As mentioned we will integrate a loading state with our api reducer which will control the loading screen. We also have our basic actions such as fetch_init and fetch_success that will simply control our loading state.

Our fetch_failure action is much more complex. It uses apiErrorHandler() function to parse the error object and display the appropriate error message to users.

```
export const apiErrorHandler = (error) => {
  if (error.response) {
    //error messages from server with response data
    if (error.response.data.type && error.response.data.message) {
      let errorMessage = error.response.data.message;
      let errorType = error.response.data.type;
      errorNotification(errorType, errorMessage);
    } else {
      console.log(error.response.data);
      let errorMessage = error.response.data.message
        ? error.response.data.message
        : 'Request Failed Please Try Again or Contact Support';
      let errorType = error.response.data.type ? error.response.data.type : '500 Server Error';
      errorNotification(errorType, errorMessage);
    }
  } else {
    let errorType = 'An Error Occurred';
    let errorMessage = 'There was an Error, please try again or contact support';
    errorNotification(errorType, errorMessage);
  }
};
```

We essentially take the error object from our server and parse it based on what the error message and type we get from our server side.

`<errorNotication />` is simply an antd component that displays the error information in a notification component.

```

import { notification } from 'antd';

const errorNotification = (errorType, errorMessage) => {
  let errorTitle = errorType ? errorType : 'Error Detected';
  let errorDescription = errorMessage
    ? errorMessage
    : 'There was an error, please contact support or try again';

  notification.error({
    message: errorTitle,
    description: errorDescription,
    duration: 10
  });
};

export default errorNotification;
```

Now we can see how to pass the state and reducer through context. We pass both the apiReducer and the initial state to the useReducer() hook.

`const [apiState, dispatchApi] = useReducer(apiReducer, initialStateApi);`

Next we can define functions that will be passed down

```
  const fetchFailure = (error) => {
    dispatchApi(Fetch_failure(error));
    throw new Error('Error Detected, code execution stopped');
  };

  const fetchInit = () => {
    dispatchApi(Fetch_init);
  };

  const fetchSuccess = () => {
    dispatchApi(Fetch_success);
  };

```

`fetchFailure()` requires a `throw new Error()` statement in order to stop code execution after an async error.

Then we can pass these down with the api context we defined earlier.

      `<ApiContext.Provider value={{ apiState, fetchFailure, fetchInit, fetchSuccess }}>`

Be sure to wrap the Root parent component in your app with the context.

This is all the setup we need to do. We can now access these functions and state through the useContext() hook. Here is an example of using this in a form submit function.

```

  const { fetchFailure, fetchInit, fetchSuccess, apiState } = useContext(ApiContext);
  const { isLoading } = apiState;



const postTodo = async (event) => {
    event.preventDefault();
    fetchInit();

    let author = user ? user.username : 'Guest';
    let title = event.target.title.value;
    let description = event.target.description.value;
    let data = { title, description, author, app_id };

    await axios.post(`/api/post/todo`, data).catch((err) => {
      fetchFailure(err);
    });

    fetchSuccess();
  };

```

The loading screen or component can be defined in the jsx.

`{isLoading && <LoadingComponent />}`

This is it for error handling in React. This gives a much cleaner way of handling errors than using a 100 try catch blocks. All the error is centralized allowing for easy modifications.
