// import { aStar } from "./algorithms/aStar.js";

// const start = "A";
// const goal = "F";

// console.log(`\n출발지: ${start}`);
// console.log(`목적지: ${goal}\n`);

// const result = aStar(start, goal);

// if (result) {
//   console.log("\n=== 탐색 완료 ===");
//   console.log("최종 경로:", result.path.join(" -> "));
//   console.log("총 이동 비용:", result.cost);
// } else {
//   console.log("경로를 찾을 수 없습니다.");
// }


import {
  aStarGeo,
} from "./algorithms/aStarGeo.js";

const start = "A";
const goal = "F";

console.log(`\n출발지: ${start}`);
console.log(`목적지: ${goal}\n`);

const result = aStarGeo(start, goal);

if (result) {
  console.log("\n=== 탐색 완료 ===");

  console.log(
    "최종 경로:",
    result.path.join(" -> ")
  );

  console.log(
    "총 이동 거리:",
    `${result.distance.toFixed(2)}m`
  );

  console.log(
    "총 이동 거리:",
    `${(result.distance / 1000).toFixed(3)}km`
  );
} else {
  console.log(
    "경로를 찾을 수 없습니다."
  );
}