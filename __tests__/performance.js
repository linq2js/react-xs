import $ from "react-xs";

test("Test class", () => {
  const start = new Date().getTime();
  for (let i = 0; i < 10000; i++) {
    const state = $({ name: "Hung" });
    state.prop`name`.value = "Hello";
  }
  console.log(new Date().getTime() - start);
});
