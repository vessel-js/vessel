export function sortObjectKeys(obj: any) {
  return Object.keys(obj)
    .sort()
    .reduce((o, key) => {
      o[key] = obj[key];
      return o;
    }, {});
}
