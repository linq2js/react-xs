import $ from "react-xs";

test("1 -> add(1) -> 2", () => {
  const state = $(1);

  state.add(1);

  expect(state.value).toBe(2);
});

test("1 -> add(-1) -> 0", () => {
  const state = $(1);

  state.add(-1);

  expect(state.value).toBe(0);
});

test("1 -> mul(2) -> 2", () => {
  const state = $(1);

  state.mul(2);

  expect(state.value).toBe(2);
});

test("2 -> div(2) -> 1", () => {
  const state = $(2);

  state.div(2);

  expect(state.value).toBe(1);
});

test("2019-01-01 -> add(1, D) -> 2019-01-02", () => {
  const state = $(new Date("2019-01-01"));

  state.add(1, "D");

  expect(state.value).toEqual(new Date("2019-01-02"));
});

test("2019-01-01 -> add(1, D, 2, M, 3, Y) -> 2022-03-02", () => {
  const state = $(new Date("2019-01-01"));

  state.add(1, "D", 2, "M", 3, "Y");

  expect(state.value).toEqual(new Date("2022-03-02"));
});

test("2019-01-01 -> add(1, T) -> 2020-01-01", () => {
  const state = $(new Date("2019-01-01"));

  state.add(1, "Y");

  expect(state.value).toEqual(new Date("2020-01-01"));
});

test("toggle props", () => {
  const state = $({ flag1: false, flag2: true });

  state.toggle("flag1", "flag2");

  expect(state.value).toEqual({ flag1: true, flag2: false });
});

test("toggle value", () => {
  const state = $({ flag1: false, flag2: true });

  state.prop`flag1`.toggle();
  state.prop`flag2`.toggle();

  expect(state.value).toEqual({ flag1: true, flag2: false });
});

test("set(name, Hung)", () => {
  const state = $({ name: "Unknown" });

  state.set("name", "Hung");

  expect(state.value).toEqual({ name: "Hung" });
});

test("set(Hung)", () => {
  const state = $({ name: "Unknown" });

  state.prop`name`.set("Hung");

  expect(state.value).toEqual({ name: "Hung" });
});

test("unset(prop1, prop2)", () => {
  const state = $({ prop1: true, prop2: true });

  state.unset("prop1", "prop2");

  expect(state.value).toEqual({});
});
