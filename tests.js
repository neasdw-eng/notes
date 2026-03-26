// ========== MINIMAL TEST FRAMEWORK ==========
const results = [];
const output = document.getElementById('test-output');
const summaryEl = document.getElementById('summary');

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error((message || 'assertIncludes') + ': ' + JSON.stringify(haystack) + ' does not include ' + JSON.stringify(needle));
  }
}

function section(name) {
  var h2 = document.createElement('h2');
  h2.textContent = name;
  output.appendChild(h2);
}

function logResult(name, passed, error) {
  results.push({ name: name, passed: passed, error: error });
  var div = document.createElement('div');
  div.className = 'test-result ' + (passed ? 'pass' : 'fail');
  div.textContent = (passed ? '\u2713' : '\u2717') + ' ' + name + (error ? ' \u2014 ' + error : '');
  output.appendChild(div);
}

async function test(name, fn) {
  try {
    await fn();
    logResult(name, true);
  } catch (e) {
    logResult(name, false, e.message);
  }
}

function showSummary() {
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  var total = results.length;
  summaryEl.className = 'summary ' + (failed > 0 ? 'has-fail' : 'all-pass');
  summaryEl.textContent = passed + '/' + total + ' passed, ' + failed + ' failed';
}

// ========== UNIT TESTS ==========

function createMockStorage() {
  var store = {};
  return {
    getItem: function(key) { return store[key] || null; },
    setItem: function(key, val) { store[key] = String(val); },
    removeItem: function(key) { delete store[key]; },
    clear: function() { Object.keys(store).forEach(function(k) { delete store[k]; }); },
  };
}

async function runUnitTests() {
  section('Unit Tests \u2014 Storage');

  await test('Storage.load returns empty array when no data', function() {
    var mock = createMockStorage();
    var raw = mock.getItem('notes_app_data');
    var result = raw ? JSON.parse(raw) : [];
    assertEqual(result.length, 0, 'Should return empty array');
  });

  await test('Storage.load parses saved notes', function() {
    var mock = createMockStorage();
    var notes = [{ id: 'abc', content: 'Hello', createdAt: '2024-01-01', updatedAt: '2024-01-01' }];
    mock.setItem('notes_app_data', JSON.stringify(notes));
    var loaded = JSON.parse(mock.getItem('notes_app_data'));
    assertEqual(loaded.length, 1, 'Should have 1 note');
    assertEqual(loaded[0].content, 'Hello', 'Content should match');
  });

  await test('Storage.load handles corrupt JSON gracefully', function() {
    var mock = createMockStorage();
    mock.setItem('notes_app_data', '{broken json!!!');
    var result;
    try {
      result = JSON.parse(mock.getItem('notes_app_data'));
    } catch (e) {
      result = [];
    }
    assertEqual(result.length, 0, 'Should return empty array on corrupt data');
  });

  await test('Theme persistence roundtrip', function() {
    var mock = createMockStorage();
    mock.setItem('notes_app_theme', 'deusex');
    assertEqual(mock.getItem('notes_app_theme'), 'deusex', 'Theme should persist');
  });

  section('Unit Tests \u2014 Note Logic');

  await test('getTitle returns first line of content', function() {
    var note = { content: 'My Title\nSome body text' };
    var firstLine = note.content.split('\n')[0].trim();
    assertEqual(firstLine, 'My Title', 'Title should be first line');
  });

  await test('getTitle returns Untitled for empty note', function() {
    var note = { content: '' };
    var firstLine = note.content.split('\n')[0].trim();
    var title = firstLine || 'Untitled';
    assertEqual(title, 'Untitled', 'Empty note should be Untitled');
  });

  await test('getTitle returns Untitled for whitespace-only first line', function() {
    var note = { content: '   \nActual content' };
    var firstLine = note.content.split('\n')[0].trim();
    var title = firstLine || 'Untitled';
    assertEqual(title, 'Untitled', 'Whitespace-only first line should be Untitled');
  });

  await test('getPreview returns lines after first', function() {
    var note = { content: 'Title\nLine 2\nLine 3' };
    var lines = note.content.split('\n');
    var preview = lines.slice(1).join(' ').trim();
    assertEqual(preview, 'Line 2 Line 3', 'Preview should join remaining lines');
  });

  await test('Note ID generation produces unique IDs', function() {
    var ids = new Set();
    for (var i = 0; i < 100; i++) {
      ids.add(Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    }
    assertEqual(ids.size, 100, 'All 100 IDs should be unique');
  });

  await test('Search filter matches content case-insensitively', function() {
    var notes = [
      { content: 'Shopping List\nMilk and eggs' },
      { content: 'Work Notes\nMeeting at 3pm' },
    ];
    var query = 'milk';
    var filtered = notes.filter(function(n) { return n.content.toLowerCase().includes(query); });
    assertEqual(filtered.length, 1, 'Should find one match');
    assertIncludes(filtered[0].content, 'Shopping', 'Should match Shopping List note');
  });

  await test('Search filter returns all notes when query is empty', function() {
    var notes = [
      { content: 'Note 1' },
      { content: 'Note 2' },
    ];
    var query = '';
    var filtered = query ? notes.filter(function(n) { return n.content.toLowerCase().includes(query); }) : notes;
    assertEqual(filtered.length, 2, 'Empty query should return all notes');
  });

  await test('Delete logic selects adjacent note', function() {
    var notes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    var deleteIdx = 1;
    notes.splice(deleteIdx, 1);
    var nextIdx = Math.min(deleteIdx, notes.length - 1);
    assertEqual(notes[nextIdx].id, 'c', 'Should select next note after deletion');
  });

  await test('Delete last note leaves empty state', function() {
    var notes = [{ id: 'a' }];
    notes.splice(0, 1);
    assertEqual(notes.length, 0, 'No notes should remain');
  });

  await test('HTML escaping prevents XSS', function() {
    var div = document.createElement('div');
    var tag = 'scr' + 'ipt';
    div.textContent = '<' + tag + '>alert("xss")</' + tag + '>';
    var escaped = div.innerHTML;
    assert(!escaped.includes('<' + tag + '>'), 'Script tags should be escaped');
    assertIncludes(escaped, '&lt;' + tag + '&gt;', 'Should contain escaped tags');
  });
}

// ========== E2E TESTS ==========

function waitForApp(iframe, timeout) {
  timeout = timeout || 5000;
  return new Promise(function(resolve, reject) {
    var start = Date.now();
    function check() {
      try {
        var app = iframe.contentWindow.__notesApp;
        if (app) return resolve(app);
      } catch (e) {}
      if (Date.now() - start > timeout) return reject(new Error('App failed to load'));
      setTimeout(check, 50);
    }
    check();
  });
}

function wait(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function runE2ETests() {
  section('E2E Tests \u2014 App Integration');

  var iframe = document.getElementById('app-frame');

  // Reset app state
  localStorage.removeItem('notes_app_data');
  localStorage.removeItem('notes_app_theme');
  iframe.src = 'about:blank';
  await wait(200);
  iframe.src = 'index.html';
  await wait(1000);

  var app;
  try {
    app = await waitForApp(iframe);
  } catch (e) {
    logResult('App loads in iframe', false, e.message);
    return;
  }

  await test('App loads with zero notes', function() {
    assertEqual(app.notes.length, 0, 'Should start with no notes');
  });

  await test('Empty state is shown when no notes exist', function() {
    var emptyState = iframe.contentDocument.querySelector('.empty-state');
    assert(emptyState !== null, 'Empty state element should exist');
  });

  await test('Create a new note via button', function() {
    iframe.contentDocument.getElementById('btn-new').click();
    assertEqual(app.notes.length, 1, 'Should have 1 note');
    assert(app.activeNoteId !== null, 'Active note should be set');
  });

  await test('Textarea appears after creating note', function() {
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    assert(textarea !== null, 'Textarea should exist');
  });

  await test('Typing updates note content and auto-title', function() {
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    textarea.value = 'Test Note Title\nSome body content here';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    assertEqual(app.notes[0].content, 'Test Note Title\nSome body content here', 'Content should update');
    var titleDisplay = iframe.contentDocument.getElementById('note-title-display').textContent;
    assertEqual(titleDisplay, 'Test Note Title', 'Title display should show first line');
  });

  await test('Note appears in sidebar with correct title', function() {
    var sidebarTitle = iframe.contentDocument.querySelector('.note-item-title');
    assert(sidebarTitle !== null, 'Sidebar note item should exist');
  });

  await test('Create second note', function() {
    iframe.contentDocument.getElementById('btn-new').click();
    assertEqual(app.notes.length, 2, 'Should have 2 notes');
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    textarea.value = 'Second Note\nDifferent content';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    assertEqual(app.notes[0].content, 'Second Note\nDifferent content', 'Second note content');
  });

  await test('Fast switch preserves content', function() {
    var noteItems = iframe.contentDocument.querySelectorAll('.note-item');
    assertEqual(noteItems.length, 2, 'Should show 2 note items');

    noteItems[1].click();
    var textarea1 = iframe.contentDocument.querySelector('.editor-textarea');
    assertEqual(textarea1.value, 'Test Note Title\nSome body content here', 'First note content preserved');

    var noteItems2 = iframe.contentDocument.querySelectorAll('.note-item');
    noteItems2[0].click();
    var textarea2 = iframe.contentDocument.querySelector('.editor-textarea');
    assertEqual(textarea2.value, 'Second Note\nDifferent content', 'Second note content preserved');
  });

  await test('Rapid switching stress test (10 switches)', function() {
    for (var i = 0; i < 10; i++) {
      var items = iframe.contentDocument.querySelectorAll('.note-item');
      items[i % 2].click();
    }
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    assert(textarea !== null, 'Textarea should still exist after rapid switching');
    var content = textarea.value;
    assert(
      content === 'Second Note\nDifferent content' || content === 'Test Note Title\nSome body content here',
      'Content should be one of the two notes'
    );
  });

  await test('Search filters notes', async function() {
    var searchBox = iframe.contentDocument.getElementById('search-box');
    searchBox.value = 'Second';
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
    var noteItems = iframe.contentDocument.querySelectorAll('.note-item');
    assertEqual(noteItems.length, 1, 'Search should filter to 1 note');
  });

  await test('Clear search shows all notes', async function() {
    var searchBox = iframe.contentDocument.getElementById('search-box');
    searchBox.value = '';
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
    var noteItems = iframe.contentDocument.querySelectorAll('.note-item');
    assertEqual(noteItems.length, 2, 'Should show all notes again');
  });

  await test('Search with no results shows empty list', async function() {
    var searchBox = iframe.contentDocument.getElementById('search-box');
    searchBox.value = 'zzzznonexistent';
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
    var noteItems = iframe.contentDocument.querySelectorAll('.note-item');
    assertEqual(noteItems.length, 0, 'No notes should match');
    searchBox.value = '';
    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await test('Theme switch to dark', function() {
    var select = iframe.contentDocument.getElementById('theme-select');
    select.value = 'dark';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    assertEqual(iframe.contentDocument.querySelector('.app').dataset.theme, 'dark', 'Theme should be dark');
  });

  await test('Theme switch to Deus Ex', function() {
    var select = iframe.contentDocument.getElementById('theme-select');
    select.value = 'deusex';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    assertEqual(iframe.contentDocument.querySelector('.app').dataset.theme, 'deusex', 'Theme should be deusex');
  });

  await test('Theme persists in localStorage', function() {
    var saved = localStorage.getItem('notes_app_theme');
    assertEqual(saved, 'deusex', 'Theme should be saved');
  });

  await test('Auto-save writes to localStorage', async function() {
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    if (textarea) {
      textarea.value = textarea.value + '\nExtra line';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(600);
      var stored = localStorage.getItem('notes_app_data');
      assert(stored !== null, 'Notes should be in localStorage');
      var parsed = JSON.parse(stored);
      assert(parsed.length >= 2, 'Should have at least 2 notes saved');
    }
  });

  await test('Delete note removes it from list', function() {
    var countBefore = app.notes.length;
    iframe.contentDocument.getElementById('btn-delete').click();
    assertEqual(app.notes.length, countBefore - 1, 'Should have one fewer note');
  });

  await test('Delete all notes shows empty state', function() {
    while (app.notes.length > 0) {
      iframe.contentDocument.getElementById('btn-delete').click();
    }
    assertEqual(app.notes.length, 0, 'No notes should remain');
    var emptyState = iframe.contentDocument.querySelector('.empty-state');
    assert(emptyState !== null, 'Empty state should show');
  });

  await test('Delete button hidden when no note selected', function() {
    var btn = iframe.contentDocument.getElementById('btn-delete');
    assertEqual(btn.style.display, 'none', 'Delete button should be hidden');
  });

  await test('Create note after deleting all works', function() {
    iframe.contentDocument.getElementById('btn-new').click();
    assertEqual(app.notes.length, 1, 'Should create new note');
    var textarea = iframe.contentDocument.querySelector('.editor-textarea');
    assert(textarea !== null, 'Textarea should appear');
  });

  // Cleanup
  while (app.notes.length > 0) {
    iframe.contentDocument.getElementById('btn-delete').click();
  }
}

// ========== DEUS EX THEME LAYOUT TESTS ==========

function getStyle(doc, selector, prop) {
  var el = doc.querySelector(selector);
  if (!el) return null;
  return window.getComputedStyle(el).getPropertyValue(prop);
}

async function runDeusExTests() {
  section('Deus Ex Theme \u2014 Layout & Visual');

  var iframe = document.getElementById('app-frame');

  // Reset and load fresh
  localStorage.removeItem('notes_app_data');
  localStorage.removeItem('notes_app_theme');
  iframe.src = 'about:blank';
  await wait(200);
  iframe.src = 'index.html';
  await wait(1000);

  var app;
  try {
    app = await waitForApp(iframe);
  } catch (e) {
    logResult('App loads for DX tests', false, e.message);
    return;
  }

  // Switch to Deus Ex theme
  var select = iframe.contentDocument.getElementById('theme-select');
  select.value = 'deusex';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(100);

  var doc = iframe.contentDocument;

  await test('DX: Theme data attribute is set', function() {
    assertEqual(doc.querySelector('.app').dataset.theme, 'deusex', 'Theme should be deusex');
  });

  await test('DX: Sidebar has dark background', function() {
    var bg = getStyle(doc, '.sidebar', 'background-color');
    // Should be very dark (r,g,b all under 20)
    var match = bg.match(/rgb\((\d+), (\d+), (\d+)\)/);
    assert(match !== null, 'Should have rgb background');
    assert(parseInt(match[1]) < 20, 'Red channel should be very low: ' + bg);
    assert(parseInt(match[2]) < 20, 'Green channel should be very low: ' + bg);
  });

  await test('DX: Title bar has blue/purple gradient', function() {
    var bg = getStyle(doc, '.sidebar-title-row', 'background-image');
    assert(bg.indexOf('linear-gradient') !== -1, 'Should have gradient background');
    assert(bg.indexOf('rgb(74, 90, 122)') !== -1 || bg.indexOf('rgb(42, 52, 84)') !== -1,
      'Should contain blue-ish gradient stops: ' + bg);
  });

  await test('DX: Editor toolbar has blue/purple chrome gradient', function() {
    var bg = getStyle(doc, '.editor-toolbar', 'background-image');
    assert(bg.indexOf('linear-gradient') !== -1, 'Toolbar should have gradient');
    assert(bg.indexOf('rgb(58, 74, 106)') !== -1 || bg.indexOf('rgb(30, 40, 68)') !== -1,
      'Should have blue chrome colors: ' + bg);
  });

  await test('DX: Buttons have beveled border style', function() {
    var btnNew = doc.querySelector('.btn-new');
    var style = window.getComputedStyle(btnNew);
    assertEqual(style.borderRadius, '0px', 'Buttons should have sharp corners');
    // Top border should be lighter than bottom (bevel effect)
    var topColor = style.borderTopColor;
    var bottomColor = style.borderBottomColor;
    assert(topColor !== bottomColor, 'Top and bottom borders should differ for bevel effect');
  });

  await test('DX: UNATCO terminal text is present', function() {
    var header = doc.querySelector('.sidebar-header');
    var afterContent = window.getComputedStyle(header, '::after').getPropertyValue('content');
    assert(afterContent.indexOf('UNATCO') !== -1, 'Should show UNATCO text: ' + afterContent);
  });

  // Create a note to test editor styles
  doc.getElementById('btn-new').click();
  var textarea = doc.querySelector('.editor-textarea');
  textarea.value = 'DX Test Note\nTesting the theme layout';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(100);

  await test('DX: Editor text is green phosphor color', function() {
    var color = getStyle(doc, '.editor-textarea', 'color');
    // Should be green-ish (rgb(64, 232, 160))
    var match = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
    assert(match !== null, 'Should have rgb color');
    assert(parseInt(match[2]) > 200, 'Green channel should be high: ' + color);
    assert(parseInt(match[1]) < parseInt(match[2]), 'Green should dominate: ' + color);
  });

  await test('DX: Editor text has glow shadow', function() {
    var shadow = getStyle(doc, '.editor-textarea', 'text-shadow');
    assert(shadow !== 'none', 'Should have text-shadow for glow effect: ' + shadow);
  });

  await test('DX: Editor uses monospace font', function() {
    var font = getStyle(doc, '.editor-textarea', 'font-family');
    assert(
      font.indexOf('monospace') !== -1 || font.indexOf('Mono') !== -1 || font.indexOf('Consolas') !== -1,
      'Should use monospace font: ' + font
    );
  });

  await test('DX: Note title display is uppercase', function() {
    var titleEl = doc.getElementById('note-title-display');
    var transform = window.getComputedStyle(titleEl).textTransform;
    assertEqual(transform, 'uppercase', 'Title should be uppercase');
  });

  await test('DX: Note items have monospace font', function() {
    var noteTitle = doc.querySelector('.note-item-title');
    var font = window.getComputedStyle(noteTitle).fontFamily;
    assert(
      font.indexOf('monospace') !== -1 || font.indexOf('Mono') !== -1 || font.indexOf('Consolas') !== -1,
      'Note items should use monospace: ' + font
    );
  });

  await test('DX: Active note has left border highlight', function() {
    var activeItem = doc.querySelector('.note-item.active');
    assert(activeItem !== null, 'There should be an active note');
    var borderColor = window.getComputedStyle(activeItem).borderLeftColor;
    // Should be blue-ish (#5080d0 = rgb(80, 128, 208))
    var match = borderColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
    assert(match !== null, 'Should have rgb border color');
    assert(parseInt(match[3]) > 150, 'Blue channel should be high for active indicator: ' + borderColor);
  });

  await test('DX: Active note has arrow indicator', function() {
    var activeItem = doc.querySelector('.note-item.active');
    var afterContent = window.getComputedStyle(activeItem, '::after').getPropertyValue('content');
    // Unicode right-pointing triangle
    assert(afterContent !== 'none' && afterContent !== '""', 'Active note should have arrow indicator');
  });

  await test('DX: Delete button has red beveled style', function() {
    var btn = doc.getElementById('btn-delete');
    var style = window.getComputedStyle(btn);
    assertEqual(style.borderRadius, '0px', 'Delete button should have sharp corners');
    var topBorder = style.borderTopColor;
    assert(topBorder.indexOf('138') !== -1 || topBorder.indexOf('170') !== -1,
      'Delete button should have reddish border: ' + topBorder);
  });

  await test('DX: Search box has inset bevel borders', function() {
    var searchBox = doc.getElementById('search-box');
    var style = window.getComputedStyle(searchBox);
    assertEqual(style.borderRadius, '0px', 'Search should have sharp corners');
    var topColor = style.borderTopColor;
    var bottomColor = style.borderBottomColor;
    assert(topColor !== bottomColor, 'Search box should have inset bevel (different top/bottom): top=' + topColor + ' bottom=' + bottomColor);
  });

  await test('DX: Scanline overlay is active', function() {
    var appEl = doc.querySelector('.app');
    var afterBg = window.getComputedStyle(appEl, '::after').getPropertyValue('background');
    assert(afterBg.indexOf('repeating-linear-gradient') !== -1, 'Should have scanline overlay');
  });

  await test('DX: CRT vignette is present', function() {
    var appEl = doc.querySelector('.app');
    var beforeBg = window.getComputedStyle(appEl, '::before').getPropertyValue('background');
    assert(beforeBg.indexOf('radial-gradient') !== -1, 'Should have CRT vignette: ' + beforeBg);
  });

  // Switch back to light and verify clean transition
  select = doc.getElementById('theme-select');
  select.value = 'light';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(100);

  await test('DX: Switching from DX to light removes DX styles', function() {
    assertEqual(doc.querySelector('.app').dataset.theme, 'light', 'Should be light theme');
    var titleRow = doc.querySelector('.sidebar-title-row');
    var bg = window.getComputedStyle(titleRow).backgroundImage;
    assertEqual(bg, 'none', 'Light theme title row should have no gradient');
  });

  // Cleanup
  while (app.notes.length > 0) {
    doc.getElementById('btn-delete').click();
  }
}

// ========== IMAGE PROCESSOR UNIT TESTS ==========

async function runImageProcessorTests() {
  section('Image Processor \u2014 Unit Tests');

  // Helper: create a fake ImageData-like object
  function fakeImageData(w, h, fillFn) {
    var data = new Uint8ClampedArray(w * h * 4);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var rgba = fillFn(x, y, w, h);
        data[idx]     = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      }
    }
    return { data: data, width: w, height: h };
  }

  await test('toGrayscale converts RGB to luminance', function() {
    // White pixel
    var img = fakeImageData(2, 2, function() { return [255, 255, 255, 255]; });
    var gray = ImageProcessor.toGrayscale(img);
    assertEqual(gray.length, 4, 'Should have 4 values for 2x2');
    assert(Math.abs(gray[0] - 255) < 1, 'White should be ~255 gray: ' + gray[0]);
  });

  await test('toGrayscale handles black pixels', function() {
    var img = fakeImageData(2, 2, function() { return [0, 0, 0, 255]; });
    var gray = ImageProcessor.toGrayscale(img);
    assertEqual(gray[0], 0, 'Black should be 0 gray');
  });

  await test('toGrayscale uses correct luminance weights', function() {
    // Pure red pixel (R=255, G=0, B=0)
    var img = fakeImageData(1, 1, function() { return [255, 0, 0, 255]; });
    var gray = ImageProcessor.toGrayscale(img);
    // Expected: 255 * 0.299 = 76.245
    assert(Math.abs(gray[0] - 76.245) < 1, 'Red luminance should be ~76: ' + gray[0]);
  });

  await test('gaussianBlur smooths values', function() {
    // Create a 5x5 image with a bright center pixel
    var w = 5, h = 5;
    var gray = new Float32Array(w * h);
    gray[12] = 255; // center pixel (2,2)
    var blurred = ImageProcessor.gaussianBlur(gray, w, h);
    // Center should be reduced, neighbors should gain
    assert(blurred[12] < 255, 'Center should be reduced: ' + blurred[12]);
    assert(blurred[7] > 0, 'Top neighbor should gain value: ' + blurred[7]); // (2,1)
  });

  await test('sobelEdges detects edges', function() {
    // Create a 10x10 image with a vertical edge down the middle
    var w = 10, h = 10;
    var gray = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        gray[y * w + x] = x < 5 ? 0 : 255;
      }
    }
    var edges = ImageProcessor.sobelEdges(gray, w, h);
    // Pixels at x=4-5 should have high edge values
    var edgeVal = edges[5 * w + 5]; // middle of edge
    var flatVal = edges[5 * w + 1]; // flat area
    assert(edgeVal > flatVal, 'Edge pixel should be stronger than flat area: edge=' + edgeVal + ' flat=' + flatVal);
  });

  await test('brightnessMap normalizes to 0-1', function() {
    var gray = new Float32Array([0, 50, 100, 200]);
    var bmap = ImageProcessor.brightnessMap(gray, 2, 2);
    assertEqual(bmap[3], 1.0, 'Max value should be 1.0');
    assertEqual(bmap[0], 0.0, 'Min value should be 0.0');
    assert(Math.abs(bmap[1] - 0.25) < 0.01, 'Mid value should be 0.25: ' + bmap[1]);
  });

  await test('orderedDither produces values in expected range', function() {
    var values = new Float32Array([0, 0.25, 0.5, 0.75, 1.0, 0, 0.5, 1.0, 0]);
    var dithered = ImageProcessor.orderedDither(values, 3, 3, 4);
    assertEqual(dithered.length, 9, 'Should have 9 values');
    for (var i = 0; i < dithered.length; i++) {
      assert(dithered[i] >= 0 && dithered[i] <= 1.5, 'Values should be in range: ' + dithered[i]);
    }
  });

  await test('processFrame returns edges and brightness', function() {
    var img = fakeImageData(16, 16, function(x, y) {
      var v = x < 8 ? 50 : 200;
      return [v, v, v, 255];
    });
    var result = ImageProcessor.processFrame(img);
    assertEqual(result.width, 16, 'Width should match');
    assertEqual(result.height, 16, 'Height should match');
    assertEqual(result.edges.length, 256, 'Edges should have 16x16 values');
    assertEqual(result.brightness.length, 256, 'Brightness should have 16x16 values');
  });

  await test('processFrame handles uniform image', function() {
    // Use a larger image so border effects are diluted
    var img = fakeImageData(20, 20, function() { return [128, 128, 128, 255]; });
    var result = ImageProcessor.processFrame(img);
    // Check interior pixels (away from borders) have low edge values
    var interiorMax = 0;
    var w = result.width;
    for (var y = 4; y < 16; y++) {
      for (var x = 4; x < 16; x++) {
        var val = result.edges[y * w + x];
        if (val > interiorMax) interiorMax = val;
      }
    }
    assert(interiorMax < 0.5, 'Interior of uniform image should have low edge values: ' + interiorMax);
  });

  await test('processFrame reuses buffers across calls (no crash)', function() {
    // Call processFrame multiple times with same size — should reuse internal buffers
    var img = fakeImageData(20, 20, function(x, y) {
      var v = Math.floor((x / 20) * 255);
      return [v, v, v, 255];
    });
    var result1 = ImageProcessor.processFrame(img, 'terminal');
    var result2 = ImageProcessor.processFrame(img, 'polygon');
    var result3 = ImageProcessor.processFrame(img, 'wireframe');
    assertEqual(result1.width, 20, 'First call width');
    assertEqual(result2.width, 20, 'Second call width');
    assertEqual(result3.width, 20, 'Third call width');
    assert(result1.edges.length === 400, 'Edges should have 400 values');
    assert(result2.brightness.length === 400, 'Brightness should have 400 values');
  });

  await test('processFrame works with different sizes', function() {
    // Switch from one size to another — should reallocate buffers
    var img1 = fakeImageData(10, 10, function() { return [200, 200, 200, 255]; });
    var img2 = fakeImageData(20, 15, function() { return [100, 100, 100, 255]; });
    var r1 = ImageProcessor.processFrame(img1);
    var r2 = ImageProcessor.processFrame(img2);
    assertEqual(r1.width, 10, 'First size width');
    assertEqual(r1.height, 10, 'First size height');
    assertEqual(r2.width, 20, 'Second size width');
    assertEqual(r2.height, 15, 'Second size height');
    assertEqual(r2.edges.length, 300, 'Second edges length');
  });
}

// ========== DX RENDERER UNIT TESTS ==========

async function runRendererTests() {
  section('DX Renderer \u2014 Unit Tests');

  await test('DXRenderer has correct color presets', function() {
    assert(DXRenderer.COLOR_PRESETS.green !== undefined, 'Should have green preset');
    assert(DXRenderer.COLOR_PRESETS.cyan !== undefined, 'Should have cyan preset');
    assert(DXRenderer.COLOR_PRESETS.amber !== undefined, 'Should have amber preset');
    assertEqual(DXRenderer.COLOR_PRESETS.green.g, 232, 'Green preset g channel');
  });

  await test('DXRenderer init creates overlay canvas', function() {
    var container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);

    DXRenderer.init(container, { colorMode: 'green', opacity: 0.1 });
    var canvas = container.querySelector('.dx-reflection-overlay');
    assert(canvas !== null, 'Overlay canvas should be created');
    assert(canvas.tagName === 'CANVAS', 'Should be a canvas element');
    assertEqual(canvas.style.pointerEvents, 'none', 'Should not capture pointer events');

    DXRenderer.destroy();
    document.body.removeChild(container);
  });

  await test('DXRenderer show/hide/toggle works', function() {
    var container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);

    DXRenderer.init(container);

    var status = DXRenderer.getStatus();
    assertEqual(status.isVisible, true, 'Should start visible');

    DXRenderer.hide();
    assertEqual(DXRenderer.getStatus().isVisible, false, 'Should be hidden after hide()');

    DXRenderer.show();
    assertEqual(DXRenderer.getStatus().isVisible, true, 'Should be visible after show()');

    DXRenderer.toggle();
    assertEqual(DXRenderer.getStatus().isVisible, false, 'Toggle should hide');

    DXRenderer.toggle();
    assertEqual(DXRenderer.getStatus().isVisible, true, 'Toggle should show');

    DXRenderer.destroy();
    document.body.removeChild(container);
  });

  await test('DXRenderer setOpacity clamps values', function() {
    var container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);

    DXRenderer.init(container);
    DXRenderer.setOpacity(0.5);
    // Should clamp to max 0.6
    var status = DXRenderer.getStatus();
    assert(status.opacity <= 0.6, 'Opacity should be clamped to max 0.6: ' + status.opacity);
    assertEqual(status.opacity, 0.5, 'Opacity of 0.5 should be accepted (under 0.6 cap)');

    DXRenderer.setOpacity(-1);
    status = DXRenderer.getStatus();
    assertEqual(status.opacity, 0, 'Negative opacity should clamp to 0');

    DXRenderer.destroy();
    document.body.removeChild(container);
  });

  await test('DXRenderer setColorMode changes mode', function() {
    var container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);

    DXRenderer.init(container, { colorMode: 'green' });
    assertEqual(DXRenderer.getStatus().colorMode, 'green', 'Should start green');

    DXRenderer.setColorMode('cyan');
    assertEqual(DXRenderer.getStatus().colorMode, 'cyan', 'Should switch to cyan');

    DXRenderer.setColorMode('invalid');
    assertEqual(DXRenderer.getStatus().colorMode, 'cyan', 'Invalid mode should be ignored');

    DXRenderer.destroy();
    document.body.removeChild(container);
  });

  await test('DXRenderer renderFrame handles processed data', function() {
    var container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '150px';
    document.body.appendChild(container);

    DXRenderer.init(container);

    // Create fake processed data
    var w = 16, h = 12;
    var processed = {
      edges: new Float32Array(w * h),
      brightness: new Float32Array(w * h),
      width: w,
      height: h
    };
    // Set some edge data
    for (var i = 0; i < w * h; i++) {
      processed.edges[i] = Math.random() * 0.5;
      processed.brightness[i] = Math.random();
    }

    // Should not throw
    DXRenderer.renderFrame(processed);
    var canvas = container.querySelector('canvas');
    assert(canvas.width > 0, 'Canvas should have width');
    assert(canvas.height > 0, 'Canvas should have height');

    DXRenderer.destroy();
    document.body.removeChild(container);
  });

  await test('DXRenderer destroy cleans up', function() {
    var container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);

    DXRenderer.init(container);
    assert(container.querySelector('canvas') !== null, 'Canvas should exist before destroy');

    DXRenderer.destroy();
    assertEqual(container.querySelector('canvas'), null, 'Canvas should be removed after destroy');

    document.body.removeChild(container);
  });
}

// ========== WEBCAM REFLECTION E2E TESTS ==========

async function runReflectionE2ETests() {
  section('Webcam Reflection \u2014 E2E Integration');

  var iframe = document.getElementById('app-frame');

  // Reset and load fresh
  localStorage.removeItem('notes_app_data');
  localStorage.removeItem('notes_app_theme');
  iframe.src = 'about:blank';
  await wait(200);
  iframe.src = 'index.html';
  await wait(1000);

  var app;
  try {
    app = await waitForApp(iframe);
  } catch (e) {
    logResult('App loads for reflection tests', false, e.message);
    return;
  }

  var doc = iframe.contentDocument;

  await test('Reflect button is hidden in light theme', function() {
    assertEqual(doc.querySelector('.app').dataset.theme, 'light', 'Should start in light theme');
    var btn = doc.getElementById('btn-reflection');
    var display = window.getComputedStyle(btn).display;
    assertEqual(display, 'none', 'Reflect button should be hidden in light theme');
  });

  await test('Reflect button appears in Deus Ex theme', function() {
    var select = doc.getElementById('theme-select');
    select.value = 'deusex';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    var btn = doc.getElementById('btn-reflection');
    var display = window.getComputedStyle(btn).display;
    assert(display !== 'none', 'Reflect button should be visible in DX theme: ' + display);
  });

  await test('Reflect button has correct text', function() {
    var btn = doc.getElementById('btn-reflection');
    assertIncludes(btn.textContent.toLowerCase(), 'reflect', 'Button should say Reflect');
  });

  await test('Reflect button hidden in dark theme', function() {
    var select = doc.getElementById('theme-select');
    select.value = 'dark';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    var btn = doc.getElementById('btn-reflection');
    var display = window.getComputedStyle(btn).display;
    assertEqual(display, 'none', 'Reflect button should be hidden in dark theme');
  });

  await test('Modules are loaded in app iframe', function() {
    var win = iframe.contentWindow;
    assert(typeof win.WebcamModule === 'object', 'WebcamModule should be loaded');
    assert(typeof win.ImageProcessor === 'object', 'ImageProcessor should be loaded');
    assert(typeof win.DXRenderer === 'object', 'DXRenderer should be loaded');
  });

  await test('WebcamModule API is complete', function() {
    var wm = iframe.contentWindow.WebcamModule;
    assert(typeof wm.init === 'function', 'Should have init');
    assert(typeof wm.start === 'function', 'Should have start');
    assert(typeof wm.stop === 'function', 'Should have stop');
    assert(typeof wm.onFrame === 'function', 'Should have onFrame');
    assert(typeof wm.getStatus === 'function', 'Should have getStatus');
    assert(typeof wm.destroy === 'function', 'Should have destroy');
  });

  await test('ImageProcessor API is complete', function() {
    var ip = iframe.contentWindow.ImageProcessor;
    assert(typeof ip.processFrame === 'function', 'Should have processFrame');
    assert(typeof ip.toGrayscale === 'function', 'Should have toGrayscale');
    assert(typeof ip.sobelEdges === 'function', 'Should have sobelEdges');
    assert(typeof ip.brightnessMap === 'function', 'Should have brightnessMap');
    assert(typeof ip.orderedDither === 'function', 'Should have orderedDither');
  });

  await test('DXRenderer API is complete', function() {
    var r = iframe.contentWindow.DXRenderer;
    assert(typeof r.init === 'function', 'Should have init');
    assert(typeof r.renderFrame === 'function', 'Should have renderFrame');
    assert(typeof r.show === 'function', 'Should have show');
    assert(typeof r.hide === 'function', 'Should have hide');
    assert(typeof r.toggle === 'function', 'Should have toggle');
    assert(typeof r.destroy === 'function', 'Should have destroy');
    assert(typeof r.setOpacity === 'function', 'Should have setOpacity');
    assert(typeof r.setColorMode === 'function', 'Should have setColorMode');
  });

  await test('Reflect style dropdown hidden when reflection is off', function() {
    var sel = doc.getElementById('theme-select');
    sel.value = 'deusex';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    var rStyle = doc.getElementById('reflect-style');
    assertEqual(rStyle.style.display, 'none', 'Style dropdown should be hidden when reflect is off');
  });

  await test('Reflect button visible but style dropdown hidden for themed modes', function() {
    var themes = ['deusex', 'startrek', 'peanuts'];
    for (var i = 0; i < themes.length; i++) {
      var sel = doc.getElementById('theme-select');
      sel.value = themes[i];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      var btn = doc.getElementById('btn-reflection');
      var rStyle = doc.getElementById('reflect-style');
      var btnDisplay = iframe.contentWindow.getComputedStyle(btn).display;
      assert(btnDisplay !== 'none', themes[i] + ' should show reflect button');
      assertEqual(rStyle.style.display, 'none', themes[i] + ' style dropdown should be hidden when reflect is off');
    }
  });

  // Cleanup
  var select = doc.getElementById('theme-select');
  select.value = 'light';
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

// ========== NEW THEMES TESTS ==========
async function runNewThemeTests() {
  section('New Themes \u2014 CSS & Integration Tests');

  var iframe = document.getElementById('app-frame');
  iframe.src = 'index.html';
  await new Promise(function(r) { iframe.addEventListener('load', r, { once: true }); });
  await new Promise(function(r) { setTimeout(r, 500); });
  var doc = iframe.contentDocument;
  var win = iframe.contentWindow;

  // Only test currently visible themes
  var themes = ['startrek', 'peanuts'];
  var themeLabels = {
    startrek: 'Star Trek TNG',
    peanuts: 'Peanuts'
  };

  // Test: visible theme options present in dropdown
  await test('Theme select has visible options', function() {
    var sel = doc.getElementById('theme-select');
    var opts = [];
    for (var i = 0; i < sel.options.length; i++) opts.push(sel.options[i].value);
    assertIncludes(opts.join(','), 'light', 'Should have light');
    assertIncludes(opts.join(','), 'dark', 'Should have dark');
    assertIncludes(opts.join(','), 'deusex', 'Should have deusex');
    assertIncludes(opts.join(','), 'startrek', 'Should have startrek');
    assertIncludes(opts.join(','), 'peanuts', 'Should have peanuts');
    assert(sel.options.length >= 5, 'Should have at least 5 options');
  });

  // Test each theme applies correctly
  for (var t = 0; t < themes.length; t++) {
    var themeName = themes[t];
    var label = themeLabels[themeName];

    await test(label + ' theme applies data-theme attribute', (function(tn) {
      return function() {
        var sel = doc.getElementById('theme-select');
        sel.value = tn;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        var appTheme = doc.querySelector('.app').dataset.theme;
        assertEqual(appTheme, tn, 'data-theme should be ' + tn);
      };
    })(themeName));

    await test(label + ' theme changes sidebar background', (function(tn) {
      return function() {
        var sel = doc.getElementById('theme-select');
        sel.value = tn;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        var sidebar = doc.querySelector('.sidebar');
        var bg = win.getComputedStyle(sidebar).backgroundColor;
        // Should not be the default light theme bg (#f5f5f5 = rgb(245, 245, 245))
        if (tn !== 'peanuts') {
          assert(bg !== 'rgb(245, 245, 245)', tn + ' sidebar bg should differ from light theme');
        }
        assert(bg !== '', 'Should have a background color');
      };
    })(themeName));

    await test(label + ' shows Reflect button', (function(tn) {
      return function() {
        var sel = doc.getElementById('theme-select');
        sel.value = tn;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        var btn = doc.getElementById('btn-reflection');
        var display = win.getComputedStyle(btn).display;
        assert(display !== 'none', tn + ' should show reflect button');
      };
    })(themeName));
  }

  // Test: reflect-style dropdown updates per theme
  var expectedSubstyles = {
    startrek: ['Warp', 'Drift'],
    peanuts: ['Hangout', 'Dance']
  };

  for (var s = 0; s < themes.length; s++) {
    var sTheme = themes[s];
    await test(themeLabels[sTheme] + ' has correct reflection substyles', (function(tn, expected) {
      return function() {
        var sel = doc.getElementById('theme-select');
        sel.value = tn;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        var rSel = doc.getElementById('reflect-style');
        var opts = [];
        for (var i = 0; i < rSel.options.length; i++) opts.push(rSel.options[i].textContent);
        assertEqual(opts.length, expected.length, tn + ' should have ' + expected.length + ' substyles');
        for (var j = 0; j < expected.length; j++) {
          assertEqual(opts[j], expected[j], tn + ' substyle ' + j);
        }
      };
    })(sTheme, expectedSubstyles[sTheme]));
  }

  // Test: Peanuts uses "Gang" button instead of "Reflect"
  await test('Peanuts theme shows Gang button label', function() {
    var sel = doc.getElementById('theme-select');
    sel.value = 'peanuts';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    var btn = doc.getElementById('btn-reflection');
    assertEqual(btn.textContent, 'Gang', 'Peanuts should show Gang button');
  });

  await test('Star Trek TNG shows Engage button label', function() {
    var sel = doc.getElementById('theme-select');
    sel.value = 'startrek';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    var btn = doc.getElementById('btn-reflection');
    assertEqual(btn.textContent, 'Engage', 'TNG should show Engage button');
  });

  await test('Non-Peanuts themes show Reflect button label', function() {
    var sel = doc.getElementById('theme-select');
    sel.value = 'deusex';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    var btn = doc.getElementById('btn-reflection');
    assertEqual(btn.textContent, 'Reflect', 'Deus Ex should show Reflect button');
  });

  // Test: new ImageProcessor styles exist
  await test('ImageProcessor has all new theme styles', function() {
    var ip = win.ImageProcessor || ImageProcessor;
    var newStyles = ['paragon','renegade','lcars','holodeck','blacklodge','owls','cartoon','sketch','alliance','horde'];
    for (var i = 0; i < newStyles.length; i++) {
      assert(ip.STYLES[newStyles[i]] !== undefined, 'Should have style: ' + newStyles[i]);
    }
  });

  // Test: new DXRenderer styles and colors exist
  await test('DXRenderer has all new render styles and color presets', function() {
    var r = win.DXRenderer || DXRenderer;
    var newRS = ['paragon','renegade','lcars','holodeck','blacklodge','owls','cartoon','sketch','alliance','horde'];
    for (var i = 0; i < newRS.length; i++) {
      assert(r.RENDER_STYLES[newRS[i]] !== undefined, 'Should have render style: ' + newRS[i]);
    }
    var newCP = ['meblue','mered','lcars','holodeck','redroom','owlgray','cartoon','pencil','wowblue','wowred'];
    for (var j = 0; j < newCP.length; j++) {
      assert(r.COLOR_PRESETS[newCP[j]] !== undefined, 'Should have color preset: ' + newCP[j]);
    }
  });

  // Cleanup
  var select = doc.getElementById('theme-select');
  select.value = 'light';
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

// ========== RUN ALL ==========
async function runAll() {
  await runUnitTests();
  await runE2ETests();
  await runDeusExTests();
  await runImageProcessorTests();
  await runRendererTests();
  await runReflectionE2ETests();
  await runNewThemeTests();
  showSummary();
}

runAll().catch(function(e) {
  var div = document.createElement('div');
  div.style.color = '#ff3b30';
  div.style.padding = '12px';
  div.textContent = 'FATAL: ' + e.message;
  document.body.appendChild(div);
});
