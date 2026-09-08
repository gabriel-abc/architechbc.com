/* ==========================================================================
   Minimal XLSX writer — no dependencies, no CDN, no build step.
   --------------------------------------------------------------------------
   An .xlsx file is a ZIP of XML parts. This writes that ZIP directly using
   STORE (no compression), which every spreadsheet reader accepts, so there is
   no deflate implementation to carry. Strings are written inline, which avoids
   a shared-strings table entirely.

   Deliberately not a general-purpose library. It supports exactly what the
   readiness review needs: multiple sheets, a styled header row, frozen panes,
   autofilter, column widths, wrapped text, and external hyperlinks.

   api:  buildXlsx([{ name, cols, freeze, autofilter, rows }]) -> Blob
   cell: { v, s, t }   v=value  s=style index  t='n' for number
         { v, s, link } for an external hyperlink
   ========================================================================== */
(function (root) {
  'use strict';

  /* --- CRC32 -------------------------------------------------------------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  var enc = new TextEncoder();
  function bytes(str) { return enc.encode(str); }

  /* --- ZIP (stored) ------------------------------------------------------- */
  function zip(files) {
    var chunks = [], central = [], offset = 0;

    files.forEach(function (f) {
      var name = bytes(f.name), data = f.data;
      var crc = crc32(data);

      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);          // version needed
      lh.setUint16(6, 0x0800, true);      // UTF-8 filename flag
      lh.setUint16(8, 0, true);           // method: stored
      lh.setUint16(10, 0, true);          // time
      lh.setUint16(12, 0x21, true);       // date (1996-01-01, deterministic)
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);

      chunks.push(new Uint8Array(lh.buffer), name, data);

      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, 0, true);
      cd.setUint16(14, 0x21, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    });

    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, files.length, true);
    eo.setUint16(10, files.length, true);
    eo.setUint32(12, cdSize, true);
    eo.setUint32(16, offset, true);

    return new Blob(chunks.concat(central, [new Uint8Array(eo.buffer)]),
                    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* --- helpers ------------------------------------------------------------ */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\x00-\x08|\x0B|\x0C|\x0E-\x1F/g, '');
  }
  function colName(n) {
    var s = '';
    n += 1;
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
    return s;
  }

  /* --- styles ------------------------------------------------------------
     Index map (used as cell `s`):
       0 default   1 header      2 body-wrap   3 bold
       4 hyperlink 5 sev-high    6 sev-medium  7 number-centre
       8 group     9 muted      10 title
     -------------------------------------------------------------------- */
  var STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="8">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFBFAF8"/><name val="Calibri"/></font>' +
      '<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFB3402F"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFC1662B"/><name val="Calibri"/></font>' +
      '<font><sz val="10"/><color rgb="FF7A7268"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="5">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0E1116"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F2EC"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF6EEDF"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFDDD8CF"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="11">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  /* --- sheet XML ---------------------------------------------------------- */
  function sheetXml(sheet, links) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

    if (sheet.freeze) {
      x += '<sheetViews><sheetView workbookViewId="0">' +
           '<pane ySplit="' + sheet.freeze + '" topLeftCell="A' + (sheet.freeze + 1) +
           '" activePane="bottomLeft" state="frozen"/>' +
           '</sheetView></sheetViews>';
    }
    x += '<sheetFormatPr defaultRowHeight="15"/>';

    if (sheet.cols && sheet.cols.length) {
      x += '<cols>';
      sheet.cols.forEach(function (w, i) {
        x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      });
      x += '</cols>';
    }

    x += '<sheetData>';
    sheet.rows.forEach(function (row, r) {
      x += '<row r="' + (r + 1) + '"' + (r === 0 ? ' ht="30" customHeight="1"' : '') + '>';
      row.forEach(function (cell, c) {
        if (cell === null || cell === undefined) return;
        if (typeof cell !== 'object') cell = { v: cell };
        if (cell.v === '' || cell.v === null || cell.v === undefined) {
          // Blank but styled, so borders stay continuous.
          if (cell.s) x += '<c r="' + colName(c) + (r + 1) + '" s="' + cell.s + '"/>';
          return;
        }
        var ref = colName(c) + (r + 1);
        var s = cell.s ? ' s="' + cell.s + '"' : '';
        if (cell.link) links.push({ ref: ref, url: cell.link });
        if (cell.t === 'n') {
          x += '<c r="' + ref + '"' + s + '><v>' + cell.v + '</v></c>';
        } else {
          x += '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
               esc(cell.v) + '</t></is></c>';
        }
      });
      x += '</row>';
    });
    x += '</sheetData>';

    if (sheet.autofilter) x += '<autoFilter ref="' + sheet.autofilter + '"/>';

    if (links.length) {
      x += '<hyperlinks>';
      links.forEach(function (l, i) {
        x += '<hyperlink ref="' + l.ref + '" r:id="rId' + (i + 1) + '"/>';
      });
      x += '</hyperlinks>';
    }
    x += '</worksheet>';
    return x;
  }

  /* --- build -------------------------------------------------------------- */
  function buildXlsx(sheets) {
    var files = [];

    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    sheets.forEach(function (s, i) {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    ct += '</Types>';
    files.push({ name: '[Content_Types].xml', data: bytes(ct) });

    files.push({ name: '_rels/.rels', data: bytes(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>') });

    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    sheets.forEach(function (s, i) {
      wb += '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    });
    wb += '</sheets></workbook>';
    files.push({ name: 'xl/workbook.xml', data: bytes(wb) });

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach(function (s, i) {
      rels += '<Relationship Id="rId' + (i + 1) +
              '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    });
    rels += '<Relationship Id="rId' + (sheets.length + 1) +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    rels += '</Relationships>';
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: bytes(rels) });

    files.push({ name: 'xl/styles.xml', data: bytes(STYLES) });

    sheets.forEach(function (s, i) {
      var links = [];
      var xml = sheetXml(s, links);
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: bytes(xml) });
      if (links.length) {
        var lr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        links.forEach(function (l, j) {
          lr += '<Relationship Id="rId' + (j + 1) +
                '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' +
                esc(l.url) + '" TargetMode="External"/>';
        });
        lr += '</Relationships>';
        files.push({ name: 'xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', data: bytes(lr) });
      }
    });

    return zip(files);
  }

  root.buildXlsx = buildXlsx;
  root.XLSX_STYLE = { DEFAULT: 0, HEADER: 1, BODY: 2, BOLD: 3, LINK: 4, SEV_HIGH: 5, SEV_MED: 6, NUM: 7, GROUP: 8, MUTED: 9, TITLE: 10 };
})(window);
