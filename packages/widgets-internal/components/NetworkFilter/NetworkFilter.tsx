import { useCallback, useImperativeHandle, useRef, useState } from "react";

import styled, { css } from "styled-components";

import { Trans, useTranslation } from "@pancakeswap/localization";
import {
  Button,
  IMultiSelectChangeEvent,
  IMultiSelectProps,
  MultiSelect,
  type MultiSelectHandle,
  useMatchBreakpoints,
} from "@pancakeswap/uikit";

export interface NetworkFilterHandle {
  show: () => void;
  hide: () => void;
}

export interface INetworkProps {
  multiple?: boolean;
  data: IMultiSelectProps<number>["options"];
  value: number[];
  onChange: (value: INetworkProps["value"], e: IMultiSelectChangeEvent<number>) => void;
  panelRef?: React.Ref<NetworkFilterHandle>;
  onPanelClose?: () => void;
}

export const Container = styled.div<{ $isShow: boolean }>`
  flex: 1;

  .p-multiselect-panel {
    /* hack:
     * the primereact not support to custom the placement of panel
     * we need to place fixed to bottom
     * */
    top: 0 !important;
    left: 0 !important;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -14px;
    padding: 8px 0;
  }
  ${({ $isShow, theme }) =>
    $isShow &&
    `
  && .select-input-container {
     border: 1px solid ${theme.colors.secondary};
     border-bottom: 1px solid ${theme.colors.inputSecondary};
     box-shadow: -2px -2px 2px 2px #7645D933, 2px -2px 2px 2px #7645D933;
     border-bottom-left-radius: 0;
     border-bottom-right-radius: 0;
  }
  && .p-multiselect-panel {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border: 1px solid ${theme.colors.secondary};
    box-shadow: 2px 2px 2px 2px #7645D933, -2px 2px 2px 2px #7645D933;
    border-top: none;
  }
 `}
`;

const ItemContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 24px;
  white-space: pre-wrap;

  .network-icon {
    flex: 1;
    border-radius: 35%;
  }
`;

const StyledButton = styled(Button)`
  position: absolute;
  right: 50px;

  height: 27px;
  background-color: ${({ theme }) => theme.colors.input};
  color: ${({ theme }) => theme.colors.text};
  opacity: 0;
  transition: opacity 0.3s ease-in;
`;

const sharedStyle = css`
  ${StyledButton} {
    opacity: 1;
  }
`;

const StyledContainer = styled(Container)<{ $activeIndex?: number }>`
  li.p-multiselect-item {
    padding: 8px 16px;
    transition: background-color 0.2s ease;
    cursor: pointer;
    position: relative;
    /* desktop hover effect */
    > span {
      width: 100%;
    }
    @media (hover: hover) and (pointer: fine) {
      &:hover {
        background-color: ${({ theme }) => theme.colors.secondary20};
        ${sharedStyle}
      }
    }
    ${({ $activeIndex, theme }) =>
      typeof $activeIndex === "number" &&
      `&:nth-child(${$activeIndex + 1}) {
      ${sharedStyle}
      background-color: ${theme.colors.secondary20};
    }`}
  }
`;

export const NetworkFilter: React.FC<INetworkProps> = ({
  data,
  value,
  onChange,
  multiple,
  panelRef,
  onPanelClose,
}: INetworkProps) => {
  const [isShow, setIsShow] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mobileActiveValue, setMobileActiveValue] = useState<number>(-1);
  const { isMobile } = useMatchBreakpoints();
  const { t } = useTranslation();
  const multiSelectPanelRef = useRef<MultiSelectHandle>(null);

  useImperativeHandle(panelRef, () => ({
    show: () => {
      setIsPanelOpen(true);
      setIsShow(true);
    },
    hide: () => {
      multiSelectPanelRef.current?.hide();
      setIsPanelOpen(false);
      setIsShow(false);
      onPanelClose?.();
    },
  }));

  const activeIndex =
    isMobile && mobileActiveValue !== -1 && data ? data.findIndex((opt) => opt.value === mobileActiveValue) : undefined;

  const handleSelectChange = useCallback(
    (e: IMultiSelectChangeEvent<number>) => {
      // keep the order with network list
      const sortedValue = data ? data.filter((opt) => e.value.includes(opt.value)).map((opt) => opt.value) : e.value;
      onChange(sortedValue, e);
    },
    [onChange, data]
  );

  const handleOnlyClick = useCallback(
    (networkValue: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([networkValue], {
        value: [networkValue],
        originalEvent: e,
        stopPropagation: e.stopPropagation,
        preventDefault: e.preventDefault,
      });
    },
    [onChange]
  );

  const customItemTemplate = useCallback(
    (option: { label: string; value: number; icon?: React.ReactNode | string }) => {
      const onTouchStart = isMobile
        ? () => {
            setMobileActiveValue(option.value);
          }
        : undefined;
      return (
        <ItemContainer onTouchStart={onTouchStart}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {option.icon && (
              <span style={{ marginRight: "8px", width: "24px", height: "24px" }}>
                {typeof option.icon === "string" ? (
                  <img className="network-icon" src={option.icon} alt={option.label} width="24" />
                ) : (
                  option.icon
                )}
              </span>
            )}
            <span style={{ flex: 1 }}>{option.label}</span>
          </div>

          <StyledButton scale="xs" onClick={(e: React.MouseEvent) => handleOnlyClick(option.value, e)}>
            <Trans>Only</Trans>
          </StyledButton>
        </ItemContainer>
      );
    },
    [handleOnlyClick, isMobile]
  );

  return (
    <StyledContainer $isShow={isShow} $activeIndex={activeIndex}>
      <MultiSelect
        panelRef={multiSelectPanelRef}
        overlayVisible={isPanelOpen || undefined}
        multiple={multiple}
        style={{
          backgroundColor: "var(--colors-input)",
        }}
        panelStyle={{
          backgroundColor: "var(--colors-input)",
        }}
        scrollHeight="370px"
        options={data}
        isShowSelectAll
        selectAllLabel="All networks"
        value={value}
        onShow={() => setIsShow(true)}
        onHide={() => {
          setIsShow(false);
          setIsPanelOpen(false);
          onPanelClose?.();
        }}
        onChange={handleSelectChange}
        itemTemplate={customItemTemplate}
        placeholder={t("Select Networks")}
      />
    </StyledContainer>
  );
};
