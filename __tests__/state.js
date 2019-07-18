import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import $ from "react-xs";

afterEach(cleanup);

test("Should notify change one time when update multiple states", () => {
  const state1 = $(0);
  const state2 = $(0);

  const subscription = jest.fn();

  state1.subscribe(subscription);
  state2.subscribe(subscription);

  const action = () => {
    state1.value++;
    state2.value++;
  };

  action();
  expect(subscription.mock.calls.length).toBe(2);
  $.mutate(action);
  expect(subscription.mock.calls.length).toBe(3);
});

test("Should return nested value", () => {
  const person = $({
    name: "Hung",
    age: 99,
    address: { street: "abc", city: "def" }
  });

  expect(person.prop`address`.value).toEqual({ street: "abc", city: "def" });
  expect(person.prop`address.street`.value).toBe("abc");
});

test("Should update nested value and root value", () => {
  const person = $({
    name: "Hung",
    age: 99,
    address: { street: "abc", city: "def" }
  });

  const callback = jest.fn();
  person.subscribe(callback);

  person.prop`address.street`.value = "xxx";
  person.prop`parent.age`.value = 100;

  expect(callback.mock.calls.length).toBe(2);
  expect(person.get`address.street`).toBe("xxx");
  expect(person.get`parent.age`).toBe(100);
  expect(person.value).toEqual({
    name: "Hung",
    age: 99,
    address: { street: "xxx", city: "def" },
    parent: {
      age: 100
    }
  });
});

test("Should re-render once nested prop changed not whole state", async () => {
  const person = $({
    name: "Hung",
    age: 99,
    address: { street: "abc", city: "def" }
  });
  const comp1Render = jest.fn();
  const comp2Render = jest.fn();
  const Comp1 = $(() => {
    comp1Render();
    return <>{person.value.address.street}</>;
  });
  const Comp2 = $(() => {
    comp2Render();
    return <>{person.prop`address.street`.value}</>;
  });

  await render(
    <>
      <Comp1 />
      <Comp2 />
    </>
  );

  act(() => {
    person.value = {
      ...person.value
    };
  });

  expect(comp1Render.mock.calls.length).toBe(2);
  expect(comp2Render.mock.calls.length).toBe(1);
});
