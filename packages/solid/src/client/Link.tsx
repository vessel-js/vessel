import { ParentComponent } from 'solid-js';

export type LinkProps = {
  /**
   * Specifies the URL of the linked resource.
   */
  href: VesselRoutes[keyof VesselRoutes] | URL;
  /**
   * Whether this route should begin prefetching if the user is about to interact with the link.
   *
   * @defaultValue true
   */
  prefetch?: boolean;
  /**
   * Replace the current history instead of pushing a new URL on to the stack.
   *
   * @defaultValue false
   */
  replace?: boolean;
};

const Link: ParentComponent<LinkProps> = (props) => {
  return (
    <a
      href={props.href instanceof URL ? props.href.href : props.href}
      data-prefetch={props.prefetch !== false ? '' : null}
      data-replace={props.replace ? '' : null}
    >
      {props.children}
    </a>
  );
};

export default Link;
