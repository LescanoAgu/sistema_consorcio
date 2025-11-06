// src/utils/helpers.js

/**
 * Compara dos strings alfanuméricos para ordenamiento natural.
 * Ej: "Item 2" < "Item 10"
 * @param {string} a Primera string
 * @param {string} b Segunda string
 * @param {string} key Opcional: Si los elementos son objetos, la clave que contiene el string a comparar.
 * @returns {number} -1 si a < b, 1 si a > b, 0 si a === b
 */
export const naturalSort = (a, b, key) => {
  const ax = [], bx = [];

  const strA = key ? String(a[key] || '') : String(a || '');
  const strB = key ? String(b[key] || '') : String(b || '');

  strA.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || Infinity, $2 || ""]) });
  strB.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || Infinity, $2 || ""]) });

  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }

  return ax.length - bx.length;
};