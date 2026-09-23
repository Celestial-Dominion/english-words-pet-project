import assert from "node:assert/strict";
import {
  cleanReadingSourceText,
  mergeEnglishSentences,
  mergeReadingPairs,
  shouldMergeReadingSentences,
} from "./lib-reading-cleanup.mjs";

assert.equal(
  cleanReadingSourceText("File:CAN Loonie.jpg The dollar rose."),
  "The dollar rose.",
);
assert.equal(
  cleanReadingSourceText("Tập tin:Ảnh chính thức.jpg Nội các từ chức.", "vi"),
  "Nội các từ chức.",
);
assert.equal(
  cleanReadingSourceText("UPMC Memorial Hospital shooting.png Shortly after 10:30 a.m."),
  "Shortly after 10:30 a.m.",
);
assert.equal(cleanReadingSourceText("Lee Wrights State Convention.jpg R."), "");
assert.equal(cleanReadingSourceText("File:R."), "");
assert.equal(cleanReadingSourceText("Tập tin:R.", "vi"), "");
assert.equal(
  cleanReadingSourceText("The company grew. == Sources ==*Example."),
  "The company grew.",
);
assert.equal(
  cleanReadingSourceText("The agency posted on {w|Instagram}} yesterday."),
  "The agency posted on Instagram yesterday.",
);

assert.equal(shouldMergeReadingSentences("It was developed by Ernest W.", "Burgess studied Chicago."), true);
assert.equal(shouldMergeReadingSentences("Harris was a sitting U.S.", "Senator from California."), true);
assert.equal(shouldMergeReadingSentences("The tradition began after World War I.", "It became official."), false);
assert.equal(shouldMergeReadingSentences("It was sold outside the U.S.", "Microsoft changed its plan."), false);
assert.equal(shouldMergeReadingSentences("The heat can exceed 100°C.", "Finnish saunas are dry."), false);
assert.equal(shouldMergeReadingSentences("The event began at 10:30 a.m.", "EST (1530 UTC) on Saturday."), true);
assert.equal(shouldMergeReadingSentences("The avalanche happened at 4 p.m.", "CET on Saturday."), true);
assert.equal(shouldMergeReadingSentences("She arrived at 3 a.m.", "At another office, people waited."), false);

assert.deepEqual(
  mergeEnglishSentences(["The U.S.", "Dollar fell.", "It later recovered."]),
  ["The U.S. Dollar fell.", "It later recovered."],
);
assert.deepEqual(
  mergeReadingPairs([
    { en: "It was named after Thomas J.", vi: "Nó được đặt theo tên Thomas J." },
    { en: "Watson, the chairman of IBM.", vi: "Watson, chủ tịch IBM." },
  ]),
  [{ en: "It was named after Thomas J. Watson, the chairman of IBM.", vi: "Nó được đặt theo tên Thomas J. Watson, chủ tịch IBM." }],
);

console.log("reading cleanup: 18 ca đạt");
