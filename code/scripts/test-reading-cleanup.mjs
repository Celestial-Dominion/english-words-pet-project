import assert from "node:assert/strict";
import {
  cleanReadingSourceText,
  mergeEnglishSentences,
  mergeReadingPairs,
  normalizeReadingTitle,
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
assert.equal(
  cleanReadingSourceText("Cảnh báo bắt đầu lúc 6 giờ chiều. giờ địa phương (1700 UTC).", "vi"),
  "Cảnh báo bắt đầu lúc 6 giờ chiều giờ địa phương (1700 UTC).",
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
assert.deepEqual(
  mergeReadingPairs([
    { en: "The event began at 10:30 a.m.", vi: "Sự kiện bắt đầu lúc 10 giờ 30 sáng." },
    { en: "EST on Saturday.", vi: "EST vào thứ Bảy." },
  ]),
  [{ en: "The event began at 10:30 a.m. EST on Saturday.", vi: "Sự kiện bắt đầu lúc 10 giờ 30 sáng EST vào thứ Bảy." }],
);

assert.equal(normalizeReadingTitle("giáo dục Montessori"), "Giáo dục Montessori");
assert.equal(normalizeReadingTitle("eBay mua VeriSign"), "eBay mua VeriSign");
assert.equal(normalizeReadingTitle("xAI"), "xAI");

console.log("reading cleanup: 23 ca đạt");
