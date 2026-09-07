// xlsx 에 «네이티브 엑셀 차트» 를 주입한다.
//
// 왜 이런 방식인가:
//   ExcelJS 는 차트를 만들지 못한다(addChart 없음). 차트가 든 템플릿을 load→save 해도
//   모르는 파트를 전부 버린다(2026-09-08 실험으로 확인 — 주입한 chart1.xml 이 왕복 후 사라짐).
//   그래서 «ExcelJS 가 파일을 다 만든 뒤» zip 을 열어 차트 파트를 끼워 넣는다.
//   ExcelJS 가 다시 손대지 않으므로 그대로 살아남는다.
//
// 넣는 파트(차트 1개당):
//   xl/charts/chartN.xml                  차트 정의(데이터 범위 참조)
//   xl/drawings/drawingN.xml              시트 위 위치·크기
//   xl/drawings/_rels/drawingN.xml.rels   drawing → chart
//   xl/worksheets/_rels/sheetX.xml.rels   sheet → drawing (있으면 병합)
//   [Content_Types].xml                   두 파트의 Override 추가
//   xl/worksheets/sheetX.xml              <drawing r:id="..."/> 삽입
//
// ⚠️ 스키마 순서가 틀리면 엑셀이 「복구가 필요합니다」를 띄운다. 특히:
//   - worksheet 안에서 <drawing> 은 <extLst> «앞» 이어야 한다(조건부서식 x14 가 extLst 를 만든다).
//   - c:chart 자식 순서: title → autoTitleDeleted → plotArea → legend → plotVisOnly → dispBlanksAs
//   - c:lineChart 자식 순서: grouping → varyColors → ser* → marker → axId × 2

const NS = {
  c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  xdr: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
  pkgRel: 'http://schemas.openxmlformats.org/package/2006/relationships',
}
const REL_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart'
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// ⚠️ DrawingML 의 srgbClr 은 «6자리 RGB» 만 받는다. 엑셀 팔레트(ARGB 8자리)를 그대로 넘기면
//    잘못된 값이라 «검정» 으로 떨어진다(칩이 검은 막대로 나온 원인). 여기서 한 번 걸러낸다.
const rgb = (v, fallback = '000000') => {
  const h = String(v ?? '').replace(/^#/, '')
  if (/^[0-9A-Fa-f]{6}$/.test(h)) return h.toUpperCase()
  if (/^[0-9A-Fa-f]{8}$/.test(h)) return h.slice(2).toUpperCase()   // ARGB → RGB
  return fallback
}
// 시트명에 공백·한글이 있으면 작은따옴표로 감싸야 한다. 이름 안의 ' 는 '' 로 이스케이프.
const sheetRef = (name) => `'${String(name).replace(/'/g, "''")}'`

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

// 축 ID 는 차트 안에서만 유일하면 된다. 차트마다 다른 값을 줘 충돌을 피한다.
function axIds(i) { return [100000000 + i * 2, 100000001 + i * 2] }

// smooth: 일별 데이터는 들쭉날쭉해서 각진 선이 오히려 어지럽다. 기본으로 부드럽게 잇는다.
function serXml({ sheet, name, catFrom, catTo, valFrom, valTo, color, idx = 0, smooth = true }) {
  return ''
    + '<c:ser>'
    + `<c:idx val="${idx}"/><c:order val="${idx}"/>`
    + `<c:tx><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${name}`)}</c:f></c:strRef></c:tx>`
    + `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${rgb(color)}"/></a:solidFill><a:round/></a:ln></c:spPr>`
    + '<c:marker><c:symbol val="none"/></c:marker>'
    + `<c:cat><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${catFrom}:${catTo}`)}</c:f></c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(`${sheetRef(sheet)}!${valFrom}:${valTo}`)}</c:f></c:numRef></c:val>`
    + `<c:smooth val="${smooth ? 1 : 0}"/>`
    + '</c:ser>'
}

// 막대 계열 — barDir 'bar'=가로, 'col'=세로.
function barSerXml({ sheet, name, catFrom, catTo, valFrom, valTo, color, idx = 0 }) {
  return '<c:ser>'
    + `<c:idx val="${idx}"/><c:order val="${idx}"/>`
    + `<c:tx><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${name}`)}</c:f></c:strRef></c:tx>`
    + `<c:spPr><a:solidFill><a:srgbClr val="${rgb(color)}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`
    + '<c:invertIfNegative val="0"/>'
    + `<c:cat><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${catFrom}:${catTo}`)}</c:f></c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(`${sheetRef(sheet)}!${valFrom}:${valTo}`)}</c:f></c:numRef></c:val>`
    + '</c:ser>'
}

function barChartXml({ sheet, series, i = 0, dir = 'bar', valMax = null }) {
  const [axCat, axVal] = axIds(i)
  return XML_HEAD
    + `<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}">`
    + '<c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/>'
    + '<c:plotArea><c:layout/>'
    + `<c:barChart><c:barDir val="${dir}"/><c:grouping val="clustered"/><c:varyColors val="0"/>`
    + series.map((s, k) => barSerXml({ sheet, ...s, idx: k })).join('')
    + '<c:gapWidth val="60"/>'
    + `<c:axId val="${axCat}"/><c:axId val="${axVal}"/>`
    + '</c:barChart>'
    + `<c:catAx><c:axId val="${axCat}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="${dir === 'bar' ? 'l' : 'b'}"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>`
    + '<c:tickLblPos val="nextTo"/>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>'
    + `<c:crossAx val="${axVal}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>`
    + '</c:catAx>'
    + `<c:valAx><c:axId val="${axVal}"/><c:scaling><c:orientation val="minMax"/>${valMax ? `<c:max val="${valMax}"/>` : ''}<c:min val="0"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="${dir === 'bar' ? 'b' : 'l'}"/>`
    + '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="EDF1EE"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'
    + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>'
    + '<c:tickLblPos val="nextTo"/>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>'
    + `<c:crossAx val="${axCat}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>`
    + '</c:valAx>'
    + '</c:plotArea>'
    + (series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '')
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>'
    + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'   // 카드 도형이 배경이다. 흰 사각형을 깔면 둥근 모서리를 덮는다
    + '</c:chartSpace>'
}

// 도넛 — 구성비를 한눈에. 조각별 색을 dPt 로 직접 지정한다(기본 팔레트는 우리 브랜드와 안 맞는다).
function doughnutChartXml({ sheet, name, catFrom, catTo, valFrom, valTo, colors = [] }) {
  return XML_HEAD
    + `<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}">`
    + '<c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/>'
    + '<c:plotArea><c:layout/>'
    + '<c:doughnutChart><c:varyColors val="1"/>'
    + '<c:ser><c:idx val="0"/><c:order val="0"/>'
    + `<c:tx><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${name}`)}</c:f></c:strRef></c:tx>`
    + colors.map((col, k) => '<c:dPt>'
      + `<c:idx val="${k}"/><c:bubble3D val="0"/>`
      + `<c:spPr><a:solidFill><a:srgbClr val="${rgb(col)}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr>`
      + '</c:dPt>').join('')
    + '<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>'
    + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>'
    + `<c:cat><c:strRef><c:f>${esc(`${sheetRef(sheet)}!${catFrom}:${catTo}`)}</c:f></c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(`${sheetRef(sheet)}!${valFrom}:${valTo}`)}</c:f></c:numRef></c:val>`
    + '</c:ser>'
    + '<c:firstSliceAng val="0"/><c:holeSize val="55"/>'
    + '</c:doughnutChart>'
    + '</c:plotArea>'
    + '<c:legend><c:legendPos val="b"/><c:overlay val="0"/>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="850"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr></c:legend>'
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>'
    + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'   // 카드 도형이 배경이다. 흰 사각형을 깔면 둥근 모서리를 덮는다
    + '</c:chartSpace>'
}

// 꺾은선 차트 1개짜리 chartSpace.
function lineChartXml({ sheet, series, i = 0 }) {
  const [axCat, axVal] = axIds(i)
  return XML_HEAD
    + `<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}">`
    + '<c:roundedCorners val="0"/>'
    + '<c:chart>'
    + '<c:autoTitleDeleted val="1"/>'
    + '<c:plotArea><c:layout/>'
    + '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'
    + series.map((s, k) => serXml({ sheet, ...s, idx: k })).join('')
    + '<c:marker val="0"/>'
    + `<c:axId val="${axCat}"/><c:axId val="${axVal}"/>`
    + '</c:lineChart>'
    + `<c:catAx><c:axId val="${axCat}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + '<c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>'
    + '<c:tickLblPos val="nextTo"/>'
    + '<c:txPr><a:bodyPr rot="-2700000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="700"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>'
    + `<c:crossAx val="${axVal}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>`
    + '</c:catAx>'
    + `<c:valAx><c:axId val="${axVal}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + '<c:delete val="0"/><c:axPos val="l"/>'
    + '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E8EEE9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'
    + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>'
    + '<c:tickLblPos val="nextTo"/>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>'
    + `<c:crossAx val="${axCat}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>`
    + '</c:valAx>'
    + '</c:plotArea>'
    + (series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '')
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
    + '</c:chart>'
    + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'   // 카드 도형이 배경이다. 흰 사각형을 깔면 둥근 모서리를 덮는다
    + '</c:chartSpace>'
}

// 둥근 사각형 «카드» — 뉴모피즘. 도형은 셀 위에 뜨므로 제목 글자도 도형 안에 넣는다
//   (셀에 쓰면 도형에 가린다).
//   EMU 단위: 1pt = 12700 EMU · 그림자 방향은 60000분의 1도 (45° = 2700000).
//   투명도 85% → alpha 15000 (alpha 는 «불투명도» 라서 100 - 85).
//   lines 를 주면 도형 «안» 에 여러 줄을 쓴다(KPI 타일처럼 값+라벨).
//   ⚠️ 도형은 셀 위에 뜬다 — 셀에 쓴 글자는 도형에 가려 사라진다. 반드시 도형 안에 넣을 것.
function cardShapeXml({ id, title = '', lines = null, align = 'l', vAnchor = 't', titleColor = '047857', fill = 'FFFFFF', shadow = '047857', blurPt = 30, radius = 9000 }) {
  const blur = Math.round(blurPt * 12700)
  const body = lines && lines.length
    ? lines.map(ln => `<a:p><a:pPr algn="${align}"/>`
      + `<a:r><a:rPr lang="ko-KR" sz="${ln.size || 1100}"${ln.bold === false ? '' : ' b="1"'}>`
      + `<a:solidFill><a:srgbClr val="${rgb(ln.color || titleColor)}"/></a:solidFill><a:latin typeface="Malgun Gothic"/></a:rPr>`
      + `<a:t>${esc(ln.text)}</a:t></a:r></a:p>`).join('')
    : `<a:p><a:pPr algn="${align}"/>`
      + (title
        ? `<a:r><a:rPr lang="ko-KR" sz="1100" b="1"><a:solidFill><a:srgbClr val="${rgb(titleColor)}"/></a:solidFill><a:latin typeface="Malgun Gothic"/></a:rPr><a:t>${esc(title)}</a:t></a:r>`
        : '<a:endParaRPr lang="ko-KR"/>')
      + '</a:p>'
  return '<xdr:sp macro="" textlink="">'
    + `<xdr:nvSpPr><xdr:cNvPr id="${id}" name="Card ${id}"/><xdr:cNvSpPr/></xdr:nvSpPr>`
    + '<xdr:spPr>'
    + '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm>'
    + `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${radius}"/></a:avLst></a:prstGeom>`
    + `<a:solidFill><a:srgbClr val="${rgb(fill, 'FFFFFF')}"/></a:solidFill>`
    + '<a:ln><a:noFill/></a:ln>'
    // blurPt 0 = 그림자 없음. 0 으로 두면 «흐림 없는 딱딱한 그림자» 가 생겨 오히려 지저분하다.
    + (blurPt > 0
      ? '<a:effectLst>'
        + `<a:outerShdw blurRad="${blur}" dist="${Math.round(6 * 12700)}" dir="2700000" algn="tl" rotWithShape="0">`
        + `<a:srgbClr val="${rgb(shadow)}"><a:alpha val="15000"/></a:srgbClr>`
        + '</a:outerShdw>'
        + '</a:effectLst>'
      : '')
    + '</xdr:spPr>'
    + '<xdr:txBody>'
    + `<a:bodyPr lIns="114300" tIns="76200" rIns="91440" bIns="45720" anchor="${vAnchor}" wrap="square"/><a:lstStyle/>`   // ⚠️ vertOverflow="clip" 을 주면 높이가 조금만 모자라도 둘째 줄이 «통째로» 사라진다(KPI 라벨 실종)
    + body
    + '</xdr:txBody>'
    + '</xdr:sp>'
}

// EMU 오프셋을 받는다 — 셀 격자만으로는 «조금만» 띄우기가 안 된다(1cm = 360000 EMU).
function anchorXml(anchor, inner) {
  const { fromCol, fromRow, toCol, toRow, fromColOff = 0, fromRowOff = 0, toColOff = 0, toRowOff = 0 } = anchor
  return '<xdr:twoCellAnchor>'
    + `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>${Math.round(fromColOff)}</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>${Math.round(fromRowOff)}</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>${Math.round(toColOff)}</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>${Math.round(toRowOff)}</xdr:rowOff></xdr:to>`
    + inner
    + '<xdr:clientData/>'
    + '</xdr:twoCellAnchor>'
}

// ⚠️ 워크시트 하나에 drawing 파트는 «하나» 다. 차트가 여러 개면 앵커를 한 drawing 에 모아야 한다.
//    차트마다 drawing 을 만들면 첫 개만 붙고 나머지는 고아 파트가 된다(대시보드에서 실제로 겪음).
//    ⚠️ z-순서 = 문서 순서. 카드 도형을 «먼저» 써야 차트가 그 위에 올라온다.
function drawingXml(items = [], cards = []) {
  return XML_HEAD
    + `<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}">`
    + cards.map((c, k) => anchorXml(c.anchor, cardShapeXml({ id: 100 + k, ...c }))).join('')
    + items.map(({ anchor, rId }, k) => anchorXml(anchor, ''
      + '<xdr:graphicFrame macro="">'
      + `<xdr:nvGraphicFramePr><xdr:cNvPr id="${k + 2}" name="Chart ${k + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
      + `<a:graphic><a:graphicData uri="${NS.c}"><c:chart xmlns:c="${NS.c}" xmlns:r="${NS.r}" r:id="${rId}"/></a:graphicData></a:graphic>`
      + '</xdr:graphicFrame>')).join('')
    + '</xdr:wsDr>'
}

// 워크시트 XML 에 <drawing/> 을 «스키마가 허용하는 자리» 에 넣는다.
function insertDrawingTag(sheetXml, rId) {
  if (sheetXml.includes('<drawing ')) return sheetXml   // 이미 있으면 건드리지 않는다
  const tag = `<drawing r:id="${rId}"/>`
  const ext = sheetXml.indexOf('<extLst>')
  if (ext !== -1) return sheetXml.slice(0, ext) + tag + sheetXml.slice(ext)
  return sheetXml.replace('</worksheet>', `${tag}</worksheet>`)
}

// 시트 이름 → xl/worksheets/sheetX.xml 경로. workbook.xml + rels 를 따라간다(순서 추측 금지).
async function sheetPathOf(zip, sheetName) {
  const wbXml = await zip.file('xl/workbook.xml').async('string')
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const m = [...wbXml.matchAll(/<sheet[^>]*\sname="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g)]
    .find(x => x[1] === sheetName)
  if (!m) return null
  const rid = m[2]
  const rel = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"[^>]*\/>/g)]
    .find(x => x[1] === rid)
  if (!rel) return null
  const target = rel[2].replace(/^\/?xl\//, '').replace(/^\.\//, '')
  return `xl/${target}`
}

/**
 * ExcelJS 가 만든 버퍼에 네이티브 엑셀 차트를 주입한다.
 * charts: [{
 *   sheetName,                       차트를 «놓을» 시트
 *   dataSheet,                       데이터가 «있는» 시트(생략 시 sheetName)
 *   type: 'line'|'bar'|'col'|'doughnut',
 *   anchor: { fromCol, fromRow, toCol, toRow },
 *   series: [{ name, catFrom, catTo, valFrom, valTo, color, colors? }]
 * }]
 * 반환: Uint8Array (실패하면 원본 그대로 — 차트 때문에 파일이 깨지면 안 된다)
 */
export async function injectLineCharts(buffer, charts = [], cardsBySheet = {}) {
  if (!charts.length) return buffer
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    let ctXml = await zip.file('[Content_Types].xml').async('string')

    // 시트별로 묶는다 — 워크시트당 drawing 은 하나뿐이라 앵커를 한 파트에 모아야 한다.
    const bySheet = new Map()
    for (const ch of charts) {
      if (!bySheet.has(ch.sheetName)) bySheet.set(ch.sheetName, [])
      bySheet.get(ch.sheetName).push(ch)
    }

    let chartNo = 0, drawNo = 0
    for (const [sheetName, list] of bySheet) {
      const sheetPath = await sheetPathOf(zip, sheetName)
      if (!sheetPath || !zip.file(sheetPath)) continue
      drawNo += 1
      const drawPart = `xl/drawings/drawing${drawNo}.xml`
      const anchors = []
      const drawRels = []

      for (const ch of list) {
        chartNo += 1
        const chartPart = `xl/charts/chart${chartNo}.xml`
        const dataSheet = ch.dataSheet || ch.sheetName
        const xml = ch.type === 'doughnut'
          ? doughnutChartXml({ sheet: dataSheet, ...ch.series[0] })
          : ch.type === 'bar' || ch.type === 'col'
            ? barChartXml({ sheet: dataSheet, series: ch.series, i: chartNo - 1, dir: ch.type === 'col' ? 'col' : 'bar', valMax: ch.valMax })
            : lineChartXml({ sheet: dataSheet, series: ch.series, i: chartNo - 1 })
        zip.file(chartPart, xml)
        const rId = `rId${anchors.length + 1}`
        anchors.push({ anchor: ch.anchor, rId })
        drawRels.push(`<Relationship Id="${rId}" Type="${REL_CHART}" Target="../charts/chart${chartNo}.xml"/>`)
        ctXml = ctXml.replace('</Types>', `<Override PartName="/${chartPart}" ContentType="${CT_CHART}"/></Types>`)
      }

      zip.file(drawPart, drawingXml(anchors, cardsBySheet[sheetName] || []))
      zip.file(`xl/drawings/_rels/drawing${drawNo}.xml.rels`, XML_HEAD
        + `<Relationships xmlns="${NS.pkgRel}">${drawRels.join('')}</Relationships>`)
      ctXml = ctXml.replace('</Types>', `<Override PartName="/${drawPart}" ContentType="${CT_DRAWING}"/></Types>`)

      // 시트 rels — 이미 있으면 «병합»(하이퍼링크 등 기존 관계를 지우면 안 된다)
      //   경로 규칙: xl/worksheets/sheet2.xml → xl/worksheets/_rels/sheet2.xml.rels
      const relPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels')
      const relFile = zip.file(relPath)
      let rId = 'rId1'
      if (relFile) {
        const cur = await relFile.async('string')
        const used = [...cur.matchAll(/Id="rId(\d+)"/g)].map(x => Number(x[1]))
        rId = `rId${(used.length ? Math.max(...used) : 0) + 1}`
        zip.file(relPath, cur.replace('</Relationships>',
          `<Relationship Id="${rId}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawNo}.xml"/></Relationships>`))
      } else {
        zip.file(relPath, XML_HEAD
          + `<Relationships xmlns="${NS.pkgRel}">`
          + `<Relationship Id="${rId}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawNo}.xml"/>`
          + '</Relationships>')
      }

      const sheetXml = await zip.file(sheetPath).async('string')
      zip.file(sheetPath, insertDrawingTag(sheetXml, rId))
    }
    if (!chartNo) return buffer
    zip.file('[Content_Types].xml', ctXml)
    return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  } catch (e) {
    // 차트를 못 넣는 건 참을 수 있다. 파일이 안 열리는 건 못 참는다 → 원본 반환.
    console.warn('[injectLineCharts] 차트 주입 실패 — 차트 없이 내보냅니다', e)
    return buffer
  }
}
