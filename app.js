(function () {
  'use strict';
  var KEY = 'gastos-v1';
  var CATS = ['Comida', 'Transporte', 'Casa', 'Salud', 'Ocio', 'Otros'];
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  var $ = function (id) { return document.getElementById(id); };

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { alert('No se pudo guardar. Revisá el almacenamiento del navegador.'); }
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  var items = load();
  var now = new Date();
  var year = now.getFullYear(), month = now.getMonth();

  CATS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = o.textContent = c;
    $('categoria').appendChild(o);
  });
  $('fecha').value = today();

  function parseAmount(s) {
    s = String(s).trim().replace(/\s/g, '');
    if (!s) return NaN;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) {
      // the last separator is the decimal one
      if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lc > -1) {
      s = s.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, ''); // "1.500" o "1.234.567": punto como separador de miles (es-AR)
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100) / 100;
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = parseAmount($('monto').value);
    if (!(m > 0)) { alert('Ingresá un monto válido.'); $('monto').focus(); return; }
    var f = $('fecha').value || today();
    items.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      monto: m, categoria: $('categoria').value,
      desc: $('desc').value.trim(), fecha: f
    });
    save();
    $('monto').value = ''; $('desc').value = '';
    var y = +f.slice(0, 4), mo = +f.slice(5, 7) - 1;
    if (y && mo >= 0) { year = y; month = mo; }
    render();
  });

  function shift(n) {
    month += n;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    render();
  }
  $('prev').addEventListener('click', function () { shift(-1); });
  $('next').addEventListener('click', function () { shift(1); });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    var prefix = year + '-' + pad(month + 1);
    $('mes').textContent = MESES[month] + ' ' + year;
    var list = items.filter(function (x) { return String(x.fecha).slice(0, 7) === prefix; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1); });
    var total = list.reduce(function (s, x) { return s + x.monto; }, 0);
    $('total').textContent = fmt.format(total);

    var bd = $('breakdown'); bd.textContent = '';
    CATS.map(function (c) {
      return [c, list.filter(function (x) { return x.categoria === c; }).reduce(function (s, x) { return s + x.monto; }, 0)];
    }).filter(function (p) { return p[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .forEach(function (p) {
        var row = el('div', 'row'), l = el('div', 'l');
        l.appendChild(el('span', '', p[0]));
        l.appendChild(el('span', '', fmt.format(p[1])));
        var bar = el('div', 'bar'), i = document.createElement('i');
        i.style.width = (total ? p[1] / total * 100 : 0) + '%';
        bar.appendChild(i); row.appendChild(l); row.appendChild(bar); bd.appendChild(row);
      });

    var ul = $('list'); ul.textContent = '';
    $('empty').hidden = list.length > 0;
    list.forEach(function (x) {
      var li = document.createElement('li'), info = el('div', 'info');
      info.appendChild(el('div', 'd', x.desc || x.categoria));
      var p = String(x.fecha).split('-');
      info.appendChild(el('div', 's', x.categoria + ' · ' + p[2] + '/' + p[1] + '/' + p[0]));
      var del = el('button', '', '✕');
      del.type = 'button'; del.setAttribute('aria-label', 'Borrar gasto');
      del.addEventListener('click', function () {
        if (confirm('¿Borrar este gasto?')) {
          items = items.filter(function (y) { return y.id !== x.id; });
          save(); render();
        }
      });
      li.appendChild(info); li.appendChild(el('div', 'a', fmt.format(x.monto))); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function csvCell(v) {
    v = String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // avoid formula injection
    return '"' + v.replace(/"/g, '""') + '"';
  }
  $('export').addEventListener('click', function () {
    var rows = [['fecha', 'monto', 'categoria', 'descripcion']];
    items.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).forEach(function (x) {
      rows.push([x.fecha, String(x.monto), x.categoria, x.desc || '']);
    });
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'gastos.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
