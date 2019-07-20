import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import $ from "react-xs";

afterEach(cleanup);

test("Should bind states to class component properly", () => {
  const state1 = $(1);
  const state2 = $(2);
  const renderCallback = jest.fn();
  const unmountCallback = jest.fn();
  class Comp extends React.Component {
    _ = $.bind(this);

    render() {
      const value1 = state1.value;
      const value2 = state2.value;

      expect(value1).toBe(state1.value);
      expect(value2).toBe(state2.value);
      renderCallback();

      return (
        <div>
          {value1}
          {value2}
        </div>
      );
    }
    componentWillUnmount() {
      unmountCallback();
    }
  }

  const { unmount } = render(<Comp />);
  // make sure render run properly
  expect(renderCallback.mock.calls.length).toBe(1);

  state1.value = 2;
  state2.value = 3;

  // make sure re-render properly
  expect(renderCallback.mock.calls.length).toBe(3);
  unmount();
  // make sure unmount properly
  expect(unmountCallback.mock.calls.length).toBe(1);

  state1.value = 3;

  // make sure no re-render
  expect(renderCallback.mock.calls.length).toBe(3);
});
