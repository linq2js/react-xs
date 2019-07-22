# react-xs

![Logo](assets/logo.png)

Minimalism state manager

## Features

|                           | react-xs | redux |
| ------------------------- | :------: | :---: |
| Provider element          |          |   ✓   |
| Action Dispatcher         |          |   ✓   |
| Action Creator            |          |   ✓   |
| Reducer                   |          |   ✓   |
| Middleware                |          |   ✓   |
| connect() HOC             |          |   ✓   |
| State Mappings / Bindings |          |   ✓   |

### react-xs has nothing special but it is powerful, easy to use, reduce code complexity and great performance

## Table of contents

1. [Counter App](#counter-app)
1. [Todo App](#todo-app-performance-test)
1. [Creating simple state](#creating-simple-state)
1. [Handling state change](#handling-state-change)
1. [Getting state value](#getting-state-value)
1. [Sub States](#sub-states)
1. [Binding states to component](#binding-states-to-component)
1. [Mutating multiple states and performance issue](#mutating-multiple-states-and-performance-issue)
1. [Mutating state using helpers](#mutating-state-using-helpers)
1. [Handling multiple states change](#handling-multiple-states-change)
1. [Computed state](#computed-state)
1. [Getting values of multiple states](#getting-values-of-multiple-states)
1. [Update values of multiple states](#update-values-of-multiple-states)
1. [Dispatching function one time when component did mount](#dispatching-function-one-time-when-component-did-mount)
1. [Best practice](#best-practice)
1. [API](#api)
1. [Credits](#credits)

## Counter App

Simplest and shortest counter app

```jsx harmony
import React from "react";
import { render } from "react-dom";
import $ from "react-xs";
const count = $(1);
const Counter = $(() => (
  <>
    <h1>{count.value}</h1>
    <button onClick={() => count.value++}>Increase</button>
  </>
));
render(<Counter />, document.getElementById("root"));
```

Compare to redux version

```jsx harmony
import React from "react";
import { render } from "react-dom";
import { createStore } from "redux";
import { Provider, connect } from "react-redux";

const reducer = (state = 0, action) => {
  switch (action.type) {
    case "INCREMENT":
      return state + 1;
    default:
      return state;
  }
};

const store = createStore(reducer);

const App = connect(state => ({ count: state }))(({ dispatch, count }) => (
  <>
    <h1>{count}</h1>
    <button onClick={() => dispatch({ type: "INCREMENT" })}>Increase</button>
  </>
));

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("root")
);
```

Redux like version

```jsx harmony
import React from "react";
import { render } from "react-dom";
import $ from "react-xs";
const connect = $;
const Count = $(1);
const Increase = () => Count.value++;
const Counter = connect(
  {
    // map state to props
    states: { count: Count },
    // dispatch to props
    actions: {
      increase: Increase
    }
  },
  ({ count, increase }) => (
    <>
      <h1>{count}</h1>
      <button onClick={increase}>Increase</button>
    </>
  )
);
render(<Counter />, document.getElementById("root"));
```

## Todo App (Performance test)

Please refer this [link](https://codesandbox.io/s/react-xs-perf-test-efxui) , an example runs with 7000 todo items (over 28.000 elements).
User can update todo text on the fly, without lagging. Redux or other state managers(Mobx, unstated) get lag with 1000-5000 todo items

## Creating simple state

```jsx harmony
import $ from "react-xs";

const numberValue = $(100);
const booleanValue = $(true);

// mutate states
numberValue.value = 1000;
booleanValue.value = false;

// keep in mind, state can be anything, no validation or restriction for state data type
numberValue.value = new Date();
```

## Handling state change

```jsx harmony
import $ from "react-xs";

const state = $(1);
state.subscribe(nextValue => console.log(nextValue));
state.value = 100;
```

## Getting state value

```jsx harmony
import $ from "react-xs";

const person = $({ name: "Hung", address: { street: "abc", city: "def" } });
person.value.name; // Hung
person.get("name"); // Hung
person.get`name`; // Hung

person.get("address.street"); // abc
person.value.address.street; // abc
person.get`address.street`; // abc
```

## Sub States

```jsx harmony
const person = $({ name: "Hung", address: { street: "abc", city: "def" } });
person.prop`address.street`.value; // abc
person.prop(`address.street`).value; // abc
```

## Binding states to component

You can use overload \$(component) to create component wrapper which binded with states.
You dont need any Provider element, no mapStateToProps needed

```jsx harmony
import React from "react";
import $ from "react-xs";
const state = $(1);
const WrappedComponent = $(props => {
  return <div>{state.value}</div>;
});
```

## Mutating multiple states and performance issue

Sometimes you need to mutate many states at same time, that might lead to performance issue because
when state changed, it notifies to all components which is using state

```jsx harmony
import React from "react";
import $ from "react-xs";

const state1 = $(1);
const state2 = $(2);

const Comp1 = $(() => <div>{state1.value}</div>);
const Comp2 = $(() => (
  <div>
    {state1.value}
    {state2.value}
  </div>
));

function DoSomething() {
  state1.value = 100; // at this time, both Comp1 and Comp2 re-render
  state2.value = 100; // Only Comp2 re-renders
}
```

We can use \$.mutate(action) to reduce component re-render times

```jsx harmony
function DoSomething() {
  $.mutate(() => {
    state1.value = 100;
    state2.value = 100;
  });
  // Comp1 and Comp2 re-render one time only
}
```

## Mutating state using helpers

react-xs provides many helpers for mutating object, array, date, number, boolean, string data types

```jsx harmony
import $ from "react-xs";

const number = $(0);
number.add(1); // 1
number.add(-2); // -1
number.mul(2); // -4
number.div(2); // -2

const obj = $({});
obj.set("name", "Hung"); // { name: 'Hung'  }
obj.toggle("male"); // { name: 'Hung', male: true  }
obj.prop`parent.address.street`.value = "abc"; // { name: 'Hung', male: true, parent: { address: { street: 'abc' } }  }
obj.unset("parent", "male"); // { name: 'Hung'  }
// set default value for prop if it is not present
obj.def("male", false); // { name: 'Hung', male: false  }
// nothing affected because male prop is present
obj.def("male", true); // { name: 'Hung', male: false  }

const array = $([]);
array.push(1, 2, 3); // [1, 2, 3]
array.splice(1, 1); // [1, 3]
array.map(x => x * 2); // [2, 6]
array.pop(); // [2]
array.shift(); // []
array.unshift(1, 2); // [1, 2]
array.filter(x => x % 2 === 0); // [2]
array.push(5, 6, 2); // [2, 5, 6, 2]
array.exclude(2); // [5, 6]
array.remove(1); // [5]
array.fill(100); // [100]
array.push(99); // [100, 99]
array.first() === 100; // true
array.last() === 99; // true
array.sort(); // [99, 100]

const date = $(new Date("2019-01-01"));

date.add(1, "Y"); // add 1 year, 2020-01-01
date.add(1, "year"); // add 1 year, 2021-01-01
// duration can be year/Y, month/M, day/D,
// hour/h, minute/m, second/s, milli
// you also add multiple durations
date.add([1, "M"], [2, "D"]); // add 1 month and 2 days, 2021-02-03
```

If you want to extend more helpers, just call \$.extend()

```jsx harmony
import $ from "react-xs";
import immhelper from "immhelper";

$.extend({
  update(specs) {
    return this.mutate(current => immhelper(current, specs));
  }
});
const state = $({
  name: "N/A"
});

state.update({
  name: ["set", "Hung"]
});

// { name: 'Hung' }
```

## Handling multiple states change

```jsx harmony
import $ from "react-xs";

const state1 = $(0);
const state2 = $(0);

$.subscribe([state1, state2], () => {
  console.log("test1", state1.value, state2.value);
});

// using debounce option
$.subscribe(
  [state1, state2],
  (state1Value, state2Value) => {
    console.log("test2", state1Value, state2Value);
  },
  {
    debounce: 100
  }
);

state1.value = 1;
state2.value = 2;

// output
// test1 1 0
// test1 1 2
// test2 1 2
```

## Computed state

```jsx harmony
import $ from "react-xs";

const state1 = $(1);
const state2 = $(2);
const state3 = $().compute([state1, state2], () => state1.value + state2.value); // state3 = 3
state1.value = 100; // state3 = 102
state2.value = 101; // state3 = 201
```

## Getting values of multiple states

```jsx harmony
import $ from "react-xs";

const state1 = $(1);
const state2 = $(2);

$.get({
  state1,
  state2
}); // { state1: 1, state2: 2 }
```

## Update values of multiple states

```jsx harmony
import $ from "react-xs";

const state1 = $(1);
const state2 = $(2);
const state3 = $(3);
$.set(
  {
    state1,
    state2
  },
  {
    state1: 5,
    state2: 6,
    state3: 7
  }
);
// state1 = 5
// state2 = 6
// state3 = 3
```

## Dispatching function one time when component did mount

```jsx harmony
import React from "react";
import { render } from "react-dom";
import $ from "react-xs";

// assign default async status to state value
// initial { loading:false, done:false, data:undefined, error:undefined }
// loading { loading:true, done:false, data:undefined, error:undefined }
// resolved { loading:false, done:true, data:any, error:undefined }
// rejected { loading:false, done:true, data:undefined, error:any }
const userProfile = $().async();
const LoadUserProfile = () => {
  // do nothing if we already fetched data
  if (userProfile.get`done`) {
    return;
  }
  // update state once promise resolved/rejected
  userProfile.async(
    fetch("https://demo9029075.mockable.io/react-xs-user-profile").then(res =>
      res.json()
    )
  );
};

const UserProfileComponent = $(() => {
  // dispatch LoadUserProfile once when component did mount
  $.one(LoadUserProfile);

  // render userProfile according to its states
  return userProfile.async({
    loading: "Loading...",
    success: data => JSON.stringify(data)
  });
});

render(<UserProfileComponent />, document.getElementById("root"));
```

## Best practice

Sometimes we try to split our app to many modules, it is hard for other state management libraries.
Here is sample project structure if you are using react-xs

<pre>
    src/
        modules/
            counter/
                components/
                    Counter/
                        container.js
                        index.js
                states.js
                actions.js
        index.js
</pre>

### modules/counter/states.js

```jsx harmony
import $ from "react-xs";
export const CountState = $(0);
```

### modules/counter/actions.js

```jsx harmony
import { CountState } from "./state.js";

export function Increase() {
  CountState.value++;
}

export function Decrease() {
  CountState.value--;
}

export async function Load() {
  const payload = await fetch(
    "https://demo9029075.mockable.io/react-xs-counter"
  ).then(res => res.json());

  CountState.value = payload.count;
}

// auto increase count each 3s
setInterval(Increase, 3000);
```

### modules/counter/components/container.js

```jsx harmony
import { CountState } from "../state.js";
import { Increase, Decrease, Load } from "../actions.js";
import $ from "react-xs";

export default $.hoc(props => {
  return {
    ...props,
    count: CountState.value,
    increase: Increase,
    decrease: Decrease,
    load: Load
  };
});
```

### modules/counter/components/index.js

```jsx harmony
import React from "react";
import container from "./container";

export default container(({ count, increase, decrease, load }) => {
  return (
    <>
      <h1>{count}</h1>
      <button onClick={increase}>Increase</button>
      <button onClick={decrease}>Decrease</button>
      <button onClick={load}>Load</button>
    </>
  );
});
```

## Working with class component

You can use react-xs with any component types, even class component.
That helps you bring react-xs power to old components and refactor them all to functional components later

```jsx harmony
import React, { Component } from "react";
import { render } from "react-dom";
import $ from "react-xs";

const Count = $(0);
const Increase = () => Count.value++;
class Counter extends Component {
  _ = $.bind(this);

  render = () => (
    <>
      <h1>{Count.value}</h1>
      <button onClick={Increase}>Increase</button>
    </>
  );
}
render(<Counter />, document.getElementById("root"));
```

## API

## Credits
