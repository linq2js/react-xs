# react-xs

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

### react-xs has nothing special but it is powerful, easy to use, reduce code complexity

## Counter App

Simplest and shortest counter app

```jsx harmony
import React from "react";
import { render } from "react-dom";
import $ from "react-xs";
const count = $(1);
const Counter = $(() => (
  <>
    <h1 data-testid="value">{count.value}</h1>
    <button data-testid="button" onClick={() => count.value++}>
      Increase
    </button>
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

## Todo App (Performance test)

Please refer this [link](https://sr4h3.codesandbox.io/) , an example runs with 5000 todo items (over 20.000 elements).
User can update todo text on the fly, without lagging. Redux or other state managers get lag from 1000-2000 todo items

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
date.add(1, "M", 2, "D"); // add 1 month and 2 days, 2021-02-03
```
