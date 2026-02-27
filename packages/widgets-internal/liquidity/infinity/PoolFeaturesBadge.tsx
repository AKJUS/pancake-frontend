import { Protocol } from "@pancakeswap/farms";
import { HookData, POOL_TYPE } from "@pancakeswap/infinity-sdk";
import { useTranslation } from "@pancakeswap/localization";
import {
  AtomBoxProps,
  AutoColumn,
  AutoRow,
  BarChartIcon,
  CurvedChartIcon,
  FlexGap,
  InfoIcon,
  ModalV2,
  Text,
  TextProps,
  useModal,
} from "@pancakeswap/uikit";
import React, { ReactNode, useMemo, useState } from "react";
import styled from "styled-components";
import { FeatureStack, FeatureStackProps } from "../../components/FeatureStack";
import { PoolFeatureModal } from "./PoolFeatureModal";
import { PoolTypeModal } from "./PoolTypeModal";
import { hookCategoryDesc } from "./hookCategoryDesc";

type PoolFeaturesBadgeProps = AtomBoxProps & {
  hookData?: HookData;
  poolType?: HookData["poolType"] | Protocol;
  showLabel?: boolean;
  labelProps?: TextProps;
  layout?: "column" | "row";
  labelTextProps?: TextProps;
  fold?: FeatureStackProps["fold"];
  showPoolType?: boolean;
  showPoolTypeInfo?: boolean;
  showPoolFeature?: boolean;
  showPoolFeatureInfo?: boolean;
  short?: boolean;
};

const TypeDivider = styled.span`
  opacity: 0.5;
  margin: 0 4px;
`;

const InfinityClammType: React.FC<{ short?: boolean }> = ({ short }) => {
  const { t } = useTranslation();
  if (short) {
    return <span>{t("CLAMM")}</span>;
  }
  return (
    <>
      <span>{t("Infinity")}</span>
      <TypeDivider>|</TypeDivider>
      <span>{t("CLAMM")}</span>
    </>
  );
};

const InfinityBinType: React.FC<{ short?: boolean }> = ({ short }) => {
  const { t } = useTranslation();
  if (short) {
    return <span>{t("LBAMM")}</span>;
  }
  return (
    <>
      <span>{t("Infinity")}</span>
      <TypeDivider>|</TypeDivider>
      <span>{t("LBAMM")}</span>
    </>
  );
};

const InfinityStableType: React.FC<{ short?: boolean }> = ({ short }) => {
  const { t } = useTranslation();
  if (short) {
    return <span>{t("stable")}</span>;
  }
  return (
    <>
      <span>{t("Infinity")}</span>
      <TypeDivider>|</TypeDivider>
      <span>{t("SS")}</span>
    </>
  );
};

export const PoolFeaturesBadge = ({
  hookData,
  fold,
  poolType,
  showPoolType = true,
  showPoolTypeInfo = false,
  showPoolFeature = true,
  showPoolFeatureInfo = false,
  labelProps = {},
  short,
  ...props
}: PoolFeaturesBadgeProps) => {
  const { t } = useTranslation();
  const type = poolType ?? hookData?.poolType;

  const poolTypeLabel = useMemo(() => {
    return type
      ? [
          [POOL_TYPE.CLAMM, Protocol.InfinityCLAMM].includes(type) ? (
            <InfinityClammType short={short} />
          ) : [POOL_TYPE.Bin, Protocol.InfinityBIN].includes(type) ? (
            <InfinityBinType short={short} />
          ) : type === Protocol.InfinitySTABLE ? (
            <InfinityStableType short={short} />
          ) : (
            type
          ),
        ]
      : [];
  }, [type, short]);

  const _poolType: POOL_TYPE | undefined = useMemo(() => {
    return type
      ? [POOL_TYPE.CLAMM, Protocol.InfinityCLAMM].includes(type)
        ? POOL_TYPE.CLAMM
        : [POOL_TYPE.Bin, Protocol.InfinityBIN].includes(type)
        ? POOL_TYPE.Bin
        : undefined
      : undefined;
  }, [type]);

  const PoolTypeIcon = useMemo(
    () =>
      type && [POOL_TYPE.CLAMM, Protocol.InfinityCLAMM, Protocol.V3].includes(type) ? (
        <CurvedChartIcon color="textSubtle" />
      ) : (
        <BarChartIcon color="textSubtle" />
      ),
    [type]
  );
  const [onPresentPoolTypeModal] = useModal(<PoolTypeModal poolType={_poolType} />);

  const PoolTypeComponent = useMemo(
    () => (
      <FeatureItem
        features={poolTypeLabel}
        {...props}
        labelText={t("pool type")}
        labelProps={labelProps}
        icon={PoolTypeIcon}
        fold={false}
        link={hookData?.learnMoreLink}
      />
    ),
    [PoolTypeIcon, labelProps, poolTypeLabel, props, t]
  );

  return (
    <>
      {showPoolType && poolTypeLabel.length ? (
        showPoolTypeInfo ? (
          <FlexGap gap="4px">
            {PoolTypeComponent}
            {showPoolTypeInfo ? (
              <InfoIcon
                color="textSubtle"
                width={18}
                height={18}
                onClick={onPresentPoolTypeModal}
                style={{ cursor: "pointer" }}
              />
            ) : null}
          </FlexGap>
        ) : (
          PoolTypeComponent
        )
      ) : null}

      {!!(showPoolFeature && hookData?.category?.length) && (
        <FeatureItem
          features={hookData.category}
          link={hookData?.learnMoreLink}
          showPoolFeatureInfo={showPoolFeatureInfo}
          {...props}
          labelText={t("Pool features")}
          labelProps={labelProps}
          fold={fold}
          clickable
        />
      )}
    </>
  );
};

type FeatureItemProps = PoolFeaturesBadgeProps & {
  features: FeatureStackProps["features"];
  icon?: FeatureStackProps["icon"];
  labelText: string;
  fold?: FeatureStackProps["fold"];
  clickable?: boolean;
  link?: string;
};

export const FeatureItem = ({
  labelText,
  gap = "4px",
  layout = "column",
  features,
  icon,
  showLabel = true,
  fold = true,
  labelTextProps = {},
  showPoolFeatureInfo,
  clickable,
  link,
  ...props
}: FeatureItemProps) => {
  const { t } = useTranslation();
  const LayoutContainer = layout === "column" ? AutoColumn : AutoRow;
  const FeaturesContainer = layout === "column" ? AutoRow : AutoColumn;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [featureContent, setFeatureContent] = useState<ReactNode>();
  // const [selectFeature, setSelectFeature] = useState<React.ReactNode>();
  const onItemClick = (feature: React.ReactNode) => {
    if (typeof feature === "string" && hookCategoryDesc[feature as keyof typeof hookCategoryDesc]) {
      setFeatureContent(hookCategoryDesc[feature as keyof typeof hookCategoryDesc]);
      // setSelectFeature(feature);
      setIsModalOpen(true);
    }
  };

  return (
    <LayoutContainer gap={gap} justifyContent="space-between" {...props}>
      {showLabel && (
        <Text fontSize={12} color="textSubtle" textTransform="uppercase" {...labelTextProps}>
          {labelText}
        </Text>
      )}
      <FeaturesContainer gap="4px">
        <FeatureStack
          features={features}
          icon={icon}
          fold={fold}
          showInfoIcon={showPoolFeatureInfo}
          onItemClick={clickable ? onItemClick : undefined}
        />
        {clickable && (
          <ModalV2 isOpen={isModalOpen} onDismiss={() => setIsModalOpen(false)} closeOnOverlayClick>
            <PoolFeatureModal content={featureContent} title={t("Pool feature")} link={link} />
          </ModalV2>
        )}
      </FeaturesContainer>
    </LayoutContainer>
  );
};
