import $ from "react-xs";

const state1 = $(0);
const state2 = $(1);

const Increase = () => {
  state1.value++;
  state2.value++;
};

const reset = $.snapshot(state1, state2);

afterEach(reset);

test("test 1", () => {
  Increase();
  expect(state1.value).toBe(1);
  expect(state2.value).toBe(2);
});

test("test 2", () => {
  Increase();
  expect(state1.value).toBe(1);
  expect(state2.value).toBe(2);
});

test("test 3", () => {
  Increase();
  expect(state1.value).toBe(1);
  expect(state2.value).toBe(2);
});
