import { useTranslation } from "@pancakeswap/localization";
import { SwapCSS } from "@pancakeswap/uikit";
import { escapeRegExp } from "@pancakeswap/utils/escapeRegExp";
import clsx from "clsx";
import { memo, useMemo } from "react";
import { styled } from "styled-components";
import { truncateDecimals } from "../utils/numbers";

const StyledInput = styled.input`
  /* will-change: font-size;
  transition: font-size 0.2s ease-in-out; */
`;

const inputRegex = RegExp(`^\\d*(?:\\\\[.])?\\d*$`); // match escaped "." characters via in a non-capturing group

export type NumericalInputProps = {
  value: string | number | undefined;
  prefix?: string;
  fontSize?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  padding?: string;
  maxDecimals?: number;
  onUserInput: (input: string) => void;
} & SwapCSS.InputVariants &
  Omit<React.HTMLProps<HTMLInputElement>, "ref" | "onChange" | "as">;

export const NumericalInput = memo(function InnerInput({
  value,
  onUserInput,
  placeholder,
  error,
  align,
  className,
  loading,
  fontSize,
  inputRef,
  padding,
  maxDecimals,
  prefix,
  ...rest
}: NumericalInputProps) {
  const enforcer = (nextUserInput: string) => {
    if (nextUserInput === "" || inputRegex.test(escapeRegExp(nextUserInput))) {
      onUserInput(truncateDecimals(nextUserInput, maxDecimals));
    }
  };

  const { t } = useTranslation();

  const truncatedValue = useMemo(() => {
    const nextValue = typeof value === "string" ? truncateDecimals(value, maxDecimals) : value;
    if (!prefix || nextValue === "" || nextValue === undefined || nextValue === null) {
      return nextValue;
    }
    return `${prefix}${nextValue}`;
  }, [value, maxDecimals, prefix]);

  return (
    <StyledInput
      className={clsx(
        className,
        SwapCSS.inputVariants({
          error,
          align,
          loading,
        })
      )}
      {...rest}
      value={truncatedValue}
      onChange={(event) => {
        // replace commas with periods, because we exclusively uses period as the decimal separator
        const nextValue = event.target.value.replace(/,/g, ".");
        const normalizedValue = prefix ? nextValue.replace(new RegExp(escapeRegExp(prefix), "g"), "") : nextValue;
        enforcer(normalizedValue);
      }}
      // universal input options
      inputMode="decimal"
      title={t("Token Amount")}
      autoComplete="off"
      autoCorrect="off"
      // text-specific options
      type="text"
      pattern="^[0-9]*[.,]?[0-9]*$"
      placeholder={placeholder || "0.00"}
      minLength={1}
      maxLength={79}
      spellCheck="false"
      style={{ fontWeight: 600, fontSize: fontSize ?? "24px", padding }}
      ref={inputRef}
    />
  );
});
