/**
 * @OnlyCurrentDoc
 *
 * The statistics collector for davidhjalmarlindberg.com.
 *
 * This is the source of the Apps Script attached to the Google Sheet "Statistik för
 * davidhjalmarlindberg.com" in David's Drive (in the sheet: Extensions > Apps Script). It is
 * deployed as a web app (Execute as: me, Who has access: Anyone), and /stats.js on every page of the
 * site sends its counts to the web app's /exec address.
 *
 * The sheet keeps daily totals only. The tab "Data" has one row per day, part of the site
 * (sajten, andrum, colobri), measure and key, with a count, and for time on the page a sum of
 * seconds. Nothing about a single visitor is kept: no IP address (Apps Script never sees it), no
 * cookie, no id. Once a day, at the first count after midnight in Stockholm, equal rows are added
 * together, and days older than 120 days become months, so the sheet stays small for the
 * statistics dashboard, which reads the first tab.
 *
 * Counts from a page opened with ?stats=test go to the tab "Test" instead.
 *
 * E-mail addresses before a download (/download-gate.js) come to the same web app, one at a time, and are
 * written as they arrive to the tab "E-post": one row per download with the time (Stockholm), the address, the
 * product, the file, where they came from (utm_source or the site
 * that sent them), utm_campaign and the page. Nothing there is ever added up or removed by the script. From a page
 * opened with ?stats=test they go to "E-post test".
 *
 * Each address comes as a message the collector before 17 Nov 2026 also understood (k: 'ev', n: 'dl', the address
 * as x, test: 1): that version filed it as a download in the tab Test. The first address after this version is
 * deployed moves those rows from Test to E-post, once (moveEarlyLeads_).
 *
 * Colobri in the browser (/colobri/app/, part colobri) also counts what is done in it: the measure "användning" with the key
 * bild or klipp (a frame or a clip opened), generera or variationer, and "export" with the key lut, capcut, png, jpg or klipp.
 *
 * After changing this file: paste it into the script, save, then Deploy > Manage deployments >
 * the web app > Edit > Version: New version > Deploy. The /exec address stays the same.
 */

var TZ = 'Europe/Stockholm';
var HEADER = ['Dag', 'Del', 'Mått', 'Nyckel', 'Antal', 'Sekunder'];
var DAILY_FOR = 120; // days kept day by day; older days are added up per month

var DEVICES = { m: 'mobil', t: 'surfplatta', d: 'dator' };
var BROWSERS = ['Safari', 'Chrome', 'Firefox', 'Edge', 'Opera', 'Samsung Internet', 'Instagram', 'Facebook'];
var SYSTEMS = ['iOS', 'iPadOS', 'Android', 'macOS', 'Windows', 'Linux', 'ChromeOS'];
var EVENTS = { dl: 'nedladdning', buy: 'köpklick', notify: 'säg till', mail: 'mejl', out: 'utlänk', use: 'användning', exp: 'export' };
var LEAD_HEADER = ['Tid', 'E-post', 'Produkt', 'Fil', 'Källa', 'Kampanj', 'Sida'];
var PRODUCTS = ['Andrum', 'Lika', 'Colobri'];
var ADDRESS = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/;

function doGet() {
  return ContentService.createTextOutput('Statistik för davidhjalmarlindberg.com tar emot räkningar här.');
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (body && body.length < 4000) {
      var hit = JSON.parse(body);
      if (hit && hit.lead === 1) {
        var lead = leadRow_(hit, new Date());
        if (lead) storeLead_(lead, hit.lt === 1);
      } else {
        var rows = rowsFor_(hit, day_(new Date()));
        if (rows.length) store_(rows, hit.test === 1);
      }
    }
  } catch (err) {
    console.warn(String(err));
  }
  return ContentService.createTextOutput('ok');
}

/** Run once from the editor: sets up the tab and asks for access to this sheet. */
function setup() {
  var sheet = tab_(SpreadsheetApp.getActiveSpreadsheet(), 'Data');
  if (sheet.getMaxColumns() > HEADER.length) sheet.deleteColumns(HEADER.length + 1, sheet.getMaxColumns() - HEADER.length);
  sheet.setColumnWidth(1, 96).setColumnWidth(2, 80).setColumnWidth(3, 150).setColumnWidth(4, 280);
  sheet.getRange('A1').setNote('Fylls i av skriptet i Tillägg > Apps Script, med räkningar från davidhjalmarlindberg.com. ' +
    'En rad per dag, del av sajten, mått och nyckel. Statistiköversikten läser den här fliken, så låt den ligga först.');
}

function rowsFor_(hit, day) {
  if (!hit || hit.v !== 1) return [];
  var path = path_(hit.p);
  if (!path) return [];
  var page = hit.nf === 1 ? '404' : path;
  var part = part_(path);
  var rows = [];
  function add(measure, key, count, seconds) {
    if (key) rows.push([day, part, measure, key, count, seconds || 0]);
  }

  if (hit.k === 'pv') {
    add('sidvisning', page, 1);
    if (hit.nf === 1) add('saknad sida', path, 1);
    if (hit.e === 1) {
      add('besök', page, 1);
      add('källa', clean_(hit.s, /^[a-z0-9][a-z0-9 ._\-()\/]*$/i, 60).toLowerCase() || '(direkt)', 1);
      add('kampanj', clean_(hit.c, /^[\w\-. +%]+$/, 60), 1);
      add('tidszon', zone_(hit.z), 1);
      add('enhet', DEVICES[hit.d] || '', 1);
      add('webbläsare', BROWSERS.indexOf(hit.b) >= 0 ? hit.b : 'Annan', 1);
      add('system', SYSTEMS.indexOf(hit.o) >= 0 ? hit.o : 'Annat', 1);
      add('språk', clean_(hit.l, /^[a-z]{2,3}$/, 3), 1);
    } else {
      var from = path_(hit.r);
      if (from && part_(from) !== part) add('inifrån', part_(from), 1);
    }
  } else if (hit.k === 'ev' && EVENTS[hit.n]) {
    add(EVENTS[hit.n], clean_(hit.x, /^[\w\-.@+()]+$/, 80) || part, 1);
    if (hit.n === 'dl') add('nedladdning tidszon', zone_(hit.z), 1);
  } else if (hit.k === 't') {
    var seconds = Math.round(Number(hit.sec));
    if (seconds >= 1 && seconds <= 1800) add('tid', page, hit.f === 1 ? 1 : 0, seconds);
  }
  return rows;
}

function store_(rows, test) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var sheet = tab_(SpreadsheetApp.getActiveSpreadsheet(), test ? 'Test' : 'Data');
    if (!test) compactOncePerDay_(sheet, rows[0][0]);
    var start = sheet.getLastRow() + 1, room = sheet.getMaxRows() - start + 1;
    if (room < rows.length) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(rows.length - room, 500));
    sheet.getRange(start, 1, rows.length, HEADER.length).setValues(rows.map(asText_));
  } finally {
    lock.releaseLock();
  }
}

/** One row for the tab "E-post", or null when something in it is not what the download form sends. */
function leadRow_(hit, now) {
  if (hit.v !== 1 || hit.hp) return null;
  var email = typeof hit.e === 'string' ? hit.e.trim() : '';
  if (email.length > 254 || !ADDRESS.test(email)) return null;
  if (PRODUCTS.indexOf(hit.pr) < 0) return null;
  return [
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'),
    email,
    hit.pr,
    clean_(hit.f, /^[\w\-. ()]+$/, 80),
    clean_(hit.s, /^[a-z0-9][a-z0-9 ._\-()\/]*$/i, 60).toLowerCase(),
    clean_(hit.c, /^[\w\-. +%]+$/, 60),
    path_(hit.p)
  ];
}

function storeLead_(row, test) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), name = test ? 'E-post test' : 'E-post';
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name, ss.getNumSheets());   // last, so Data stays first for the dashboard
      sheet.getRange(1, 1, 1, LEAD_HEADER.length).setValues([LEAD_HEADER]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 130).setColumnWidth(2, 260).setColumnWidth(4, 220);
      sheet.getRange('A1').setNote('Fylls i av skriptet i Tillägg > Apps Script: en rad per nedladdning från davidhjalmarlindberg.com, ' +
        'med adressen besökaren skrev in före nedladdningen.');
    }
    if (!test) moveEarlyLeads_(ss, sheet);
    sheet.appendRow(asLeadText_(row));
  } finally {
    lock.releaseLock();
  }
}

// a leading apostrophe keeps every cell as text, so nothing typed in the form can become a formula
function asLeadText_(row) {
  return row.map(function (v) { return "'" + v; });
}

/** The addresses the collector before 17 Nov 2026 filed in Test (nedladdning, the address as key, with "(news)"
 *  after it from the first hour, when the form had a box for news; andrum for Andrum's page, sajten for Lika's download page) move to E-post, once. */
function moveEarlyLeads_(ss, sheet) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('earlyLeadsMoved')) return;
  props.setProperty('earlyLeadsMoved', day_(new Date()));
  var test = ss.getSheetByName('Test');
  if (!test || test.getLastRow() < 2) return;
  var values = test.getRange(2, 1, test.getLastRow() - 1, HEADER.length).getValues();
  var moved = [];
  function text(v) { return String(v).replace(/^'/, ''); }
  values.forEach(function (r, i) {
    var m = /^(.+?)(\(news\))?$/.exec(text(r[3]));
    if (text(r[2]) !== 'nedladdning' || !m || !ADDRESS.test(m[1])) return;
    var day = r[0] instanceof Date ? day_(r[0]) : text(r[0]);
    sheet.appendRow(asLeadText_([day, m[1], text(r[1]) === 'andrum' ? 'Andrum' : 'Lika', '', '', '', '']));
    moved.push(i + 2);
  });
  for (var j = moved.length - 1; j >= 0; j--) test.deleteRow(moved[j]);
}

function tab_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    if (name === 'Data') { sheet = ss.getSheets()[0]; sheet.setName('Data'); } // the first tab, which the dashboard reads
    else sheet = ss.insertSheet(name, ss.getNumSheets());
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function compactOncePerDay_(sheet, today) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('compacted') === today) return;
  compact_(sheet);
  props.setProperty('compacted', today);
}

/** Adds equal rows together, and turns days older than DAILY_FOR days into months. */
function compact_(sheet) {
  var n = sheet.getLastRow() - 1;
  if (n < 1) return;
  var cutoff = day_(new Date(Date.now() - DAILY_FOR * 864e5));
  var values = sheet.getRange(2, 1, n, HEADER.length).getValues();
  var groups = {}, order = [];
  values.forEach(function (r) {
    var period = r[0] instanceof Date ? day_(r[0]) : String(r[0]);
    if (!period) return;
    if (period.length === 10 && period < cutoff) period = period.slice(0, 7);
    var id = [period, r[1], r[2], r[3]].join('\u0000');
    if (!groups[id]) { groups[id] = [period, String(r[1]), String(r[2]), String(r[3]), 0, 0]; order.push(id); }
    groups[id][4] += Number(r[4]) || 0;
    groups[id][5] += Number(r[5]) || 0;
  });
  var out = order.map(function (id) { return groups[id]; });
  out.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  if (out.length) sheet.getRange(2, 1, out.length, HEADER.length).setValues(out.map(asText_));
  if (n > out.length) sheet.getRange(2 + out.length, 1, n - out.length, HEADER.length).clearContent();
  var last = sheet.getLastRow(), max = sheet.getMaxRows();
  if (max - last > 1000) sheet.deleteRows(last + 501, max - last - 500);
}

// A leading apostrophe keeps text as text: a day stays "2026-11-05", and nothing can become a formula.
function asText_(r) {
  return ["'" + r[0], "'" + r[1], "'" + r[2], "'" + r[3], r[4], r[5]];
}

function day_(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
}

function part_(path) {
  var m = /^\/(andrum|colobri)(\/|$)/.exec(path);
  return m ? m[1] : 'sajten';
}

function path_(p) {
  if (typeof p !== 'string' || p.length > 120 || !/^\/[\w\-.~\/%]*$/.test(p)) return '';
  return p.replace(/\/index\.html$/, '/');
}

function zone_(z) {
  return clean_(z, /^[A-Za-z]+(\/[A-Za-z0-9_\-+]+){0,2}$/, 40);
}

function clean_(value, pattern, max) {
  if (typeof value !== 'string') return '';
  value = value.trim();
  return value.length <= max && pattern.test(value) ? value : '';
}
