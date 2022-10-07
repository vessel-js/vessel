import { type ClientLoadedRoute } from '@vessel-js/app';
import {
  createComponent,
  createEffect,
  createMemo,
  createSignal,
  type ParentComponent,
} from 'solid-js';

import { useVesselContext } from './context';
import {
  SERVER_DATA_KEY,
  SERVER_ERROR_KEY,
  STATIC_DATA_KEY,
} from './context-keys';

type RouteProps = {
  component?: ClientLoadedRoute['page'];
  leaf?: boolean;
};

const RouteComponent: ParentComponent<RouteProps> = (props) => {
  const context = useVesselContext();

  const resolveStaticData = () => props.component?.staticData ?? {};
  const resolveServerData = () => props.component?.serverData;
  const resolveServerError = () => props.component?.serverLoadError;

  const [staticData, setStaticData] = createSignal(resolveStaticData());
  const [serverData, setServerData] = createSignal(resolveServerData());
  const [serverError, setServerError] = createSignal(resolveServerError());

  context.set(STATIC_DATA_KEY, staticData);
  context.set(SERVER_DATA_KEY, serverData);
  context.set(SERVER_ERROR_KEY, serverError);

  createEffect(() => {
    setStaticData(resolveStaticData());
    setServerData(resolveServerData());
    setServerError(resolveServerError());
  });

  return createMemo(() =>
    props.component
      ? createComponent(props.component.module.default, {
          children: !props.leaf ? props.children : null,
        })
      : !props.leaf && props.children,
  );
};

export default RouteComponent;
