<script setup>
import { useHead } from '@vessel-js/vue/head';
import { ref } from 'vue';

const title = ref('Vessel App');

useHead({
  title: () => title.value,
});
</script>

<template>
  <h1>Vessel + Vue</h1>

  Welcome to your home page.
</template>
