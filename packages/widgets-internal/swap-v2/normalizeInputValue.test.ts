import { describe, test, expect } from "vitest";
import { normalizeInputValue } from "./NumericalInput";

describe("normalizeInputValue", () => {
  describe("without prefix", () => {
    test("should handle no commas or periods", () => {
      expect(normalizeInputValue("1234")).toBe("1234");
      expect(normalizeInputValue("0")).toBe("0");
      expect(normalizeInputValue("")).toBe("");
    });

    test("should handle single comma (decimal separator)", () => {
      expect(normalizeInputValue("1,88")).toBe("1.88");
      expect(normalizeInputValue("0,5")).toBe("0.5");
      expect(normalizeInputValue("123,456")).toBe("123.456");
    });

    test("should handle multiple commas (keep last as decimal)", () => {
      expect(normalizeInputValue("1,607,88")).toBe("1607.88");
      expect(normalizeInputValue("1,2,3,4")).toBe("123.4");
      expect(normalizeInputValue("10,000,50")).toBe("10000.50");
    });

    test("should handle period (no change needed)", () => {
      expect(normalizeInputValue("1607.88")).toBe("1607.88");
      expect(normalizeInputValue("0.5")).toBe("0.5");
      expect(normalizeInputValue("123.456")).toBe("123.456");
    });

    test("should handle comma and period together", () => {
      expect(normalizeInputValue("1,607.88")).toBe("1607.88");
      expect(normalizeInputValue("10,000.50")).toBe("10000.50");
    });

    test("should handle multiple periods (no commas)", () => {
      expect(normalizeInputValue("1.607.88")).toBe("1607.88");
      expect(normalizeInputValue("1.2.3.4")).toBe("123.4");
    });

    test("should handle edge cases", () => {
      expect(normalizeInputValue(",")).toBe(".");
      expect(normalizeInputValue(",,")).toBe(".");
      expect(normalizeInputValue(",,,")).toBe(".");
    });
  });

  describe("with prefix ($)", () => {
    test("should remove prefix with no commas or periods", () => {
      expect(normalizeInputValue("$1234", "$")).toBe("1234");
      expect(normalizeInputValue("$0", "$")).toBe("0");
      expect(normalizeInputValue("$", "$")).toBe("");
    });

    test("should remove prefix with single comma", () => {
      expect(normalizeInputValue("$1,88", "$")).toBe("1.88");
      expect(normalizeInputValue("$0,5", "$")).toBe("0.5");
      expect(normalizeInputValue("$123,456", "$")).toBe("123.456");
    });

    test("should remove prefix with multiple commas", () => {
      expect(normalizeInputValue("$1,607,88", "$")).toBe("1607.88");
      expect(normalizeInputValue("$1,2,3,4", "$")).toBe("123.4");
      expect(normalizeInputValue("$10,000,50", "$")).toBe("10000.50");
    });

    test("should remove prefix with period", () => {
      expect(normalizeInputValue("$1607.88", "$")).toBe("1607.88");
      expect(normalizeInputValue("$0.5", "$")).toBe("0.5");
      expect(normalizeInputValue("$123.456", "$")).toBe("123.456");
    });

    test("should remove prefix with comma and period", () => {
      expect(normalizeInputValue("$1,607.88", "$")).toBe("1607.88");
      expect(normalizeInputValue("$10,000.50", "$")).toBe("10000.50");
    });

    test("should remove multiple prefix occurrences", () => {
      expect(normalizeInputValue("$$123", "$")).toBe("123");
      expect(normalizeInputValue("$1$23", "$")).toBe("123");
      expect(normalizeInputValue("$$$", "$")).toBe("");
    });

    test("should handle prefix in middle of number", () => {
      expect(normalizeInputValue("1$607.88", "$")).toBe("1607.88");
      expect(normalizeInputValue("16$07.88", "$")).toBe("1607.88");
    });
  });

  describe("edge cases", () => {
    test("should handle empty string", () => {
      expect(normalizeInputValue("")).toBe("");
      expect(normalizeInputValue("", "$")).toBe("");
    });

    test("should handle only prefix", () => {
      expect(normalizeInputValue("$", "$")).toBe("");
      expect(normalizeInputValue("€", "€")).toBe("");
    });

    test("should handle trailing/leading commas", () => {
      expect(normalizeInputValue(",123")).toBe(".123");
      expect(normalizeInputValue("123,")).toBe("123.");
      expect(normalizeInputValue(",123,")).toBe("123.");
    });

    test("should handle undefined prefix", () => {
      expect(normalizeInputValue("$123.45", undefined)).toBe("$123.45");
      expect(normalizeInputValue("123.45", undefined)).toBe("123.45");
    });

    test("should handle empty prefix", () => {
      expect(normalizeInputValue("$123.45", "")).toBe("$123.45");
      expect(normalizeInputValue("123.45", "")).toBe("123.45");
    });
  });
});
