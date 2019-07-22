import $ from "react-xs";

test("Should create chunks properly", () => {
  const total = 1000;
  const chunkSize1 = 100;
  const chunkSize2 = 50;
  const chunkCount1 = total / chunkSize1;
  const chunkCount2 = total / chunkSize2;
  const parent = $(new Array(total).fill(0).map((item, index) => index)).chunk(
    chunkSize1
  );

  expect(parent.chunks.length).toBe(chunkCount1);
  for (let i = 0; i < chunkCount1; i++) {
    expect(parent.chunks[i].value.length).toBe(chunkSize1);
  }

  parent.chunk(chunkSize2);

  expect(parent.chunks.length).toBe(chunkCount2);
  for (let i = 0; i < chunkCount2; i++) {
    expect(parent.chunks[i].value.length).toBe(chunkSize2);
  }
});
