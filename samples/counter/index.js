import React from "react";
import $ from "react-xs";
const count = $(0);
const Counter = $(() => (
  <>
    <h1 data-testid="value">{count.value}</h1>
    <button data-testid="button" onClick={() => count.value++}>
      Increase
    </button>
  </>
));

export default Counter;
