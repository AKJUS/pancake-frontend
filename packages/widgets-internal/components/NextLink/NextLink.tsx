import { forwardRef } from "react";
import { styled } from "styled-components";
import NextLink from "next/link";

// react-router-dom LinkProps types
interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: any;
  replace?: boolean;
  innerRef?: React.Ref<HTMLAnchorElement>;
  // next
  prefetch?: boolean;
}

const A = styled("a").withConfig({
  shouldForwardProp: (props) => !["hideSubNav", "supportChainIds"].includes(props),
})``;

/**
 * temporary solution for migrating React Router to Next.js Link
 */
const NextLinkFromReactRouter = forwardRef<any, LinkProps>(({ to, replace, children, prefetch, ...props }, ref) => (
  <A as={NextLink} ref={ref} href={to as string} replace={replace} prefetch={prefetch} {...props}>
    {children}
  </A>
));

export default NextLinkFromReactRouter;
