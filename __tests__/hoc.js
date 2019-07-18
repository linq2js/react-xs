import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import $ from "react-xs";

afterEach(cleanup);

test("hoc can inject state properly", () => {
  const state = $(0);

  const hoc = $.hoc(props => {
    return {
      ...props,
      count: state.value
    };
  });

  const callback = jest.fn();

  const Comp = hoc(({ count }) => {
    callback(count);
    return "";
  });

  render(<Comp />);

  expect(callback.mock.calls[0][0]).toBe(0);

  act(() => {
    state.value = 1;
  });

  expect(callback.mock.calls[1][0]).toBe(1);
});
