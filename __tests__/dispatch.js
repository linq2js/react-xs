import $ from "react-xs";

test("Should dispatch async action properly", done => {
  const onResolved = jest.fn();
  const onRejected = jest.fn();
  const createPromise = () => {
    const promise = new Promise(resolve => setTimeout(resolve, 10));
    $.call(promise, [onResolved, "resolved"], [onRejected, "rejected"]);
  };

  $.call(createPromise);

  setTimeout(() => {
    expect(onResolved.mock.calls.length).toBe(1);
    expect(onResolved.mock.calls[0][0]).toBe("resolved");
    expect(onRejected.mock.calls.length).toBe(0);

    done();
  }, 200);
});
