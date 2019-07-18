import React from "react";
import Counter from "./index";
import { render, cleanup, fireEvent } from "@testing-library/react";

afterEach(cleanup);

test("Should increase count state", async () => {
  const { getByTestId } = await render(<Counter />);
  const button = getByTestId("button");
  const value = getByTestId("value");

  await fireEvent.click(button);
  expect(value.innerHTML).toBe("1");
  await fireEvent.click(button);
  expect(value.innerHTML).toBe("2");
});
