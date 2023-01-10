import './global.css';

import { RouteAnnouncer, RouterOutlet } from '@vessel-js/solid';

export default function App() {
  return (
    <>
      <RouteAnnouncer />
      <RouterOutlet />
    </>
  );
}
