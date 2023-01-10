import { useHead } from '@vessel-js/solid/head';
import { createSignal } from 'solid-js';

export default function Page() {
  const [title, setTitle] = createSignal('Vessel App');

  useHead({
    title,
  });

  return (
    <>
      <h1>Vessel + Solid JS</h1>
      Welcome to your home page.
    </>
  );
}
