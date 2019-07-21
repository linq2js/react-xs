import React from "react";
import xs from "react-xs";

const num1 = xs(1);
const num2 = xs(2);
const num3 = xs().compute([num1, num2], () => num1.value + num2.value);
const obj = xs({});

const count = xs(0);
const Counter = xs(() => (
  <>
    <h1 data-testid="value">{count.value}</h1>
    <button data-testid="button" onClick={() => count.value++}>
      Increase
    </button>
  </>
));

export default Counter;
