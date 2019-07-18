# react-xs

Minimalism state manager

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

```jsx harmony

```
