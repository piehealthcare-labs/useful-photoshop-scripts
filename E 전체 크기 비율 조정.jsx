#targetengine "resizeArtboardEngine"

app.bringToFront();

// 이미 팔레트가 열려있다면 닫기 (중복 실행 방지)
if (typeof globalArtboardPalette !== "undefined" && globalArtboardPalette !== null) {
    try { globalArtboardPalette.close(); } catch(e){}
}

var globalArtboardPalette;

function isArtboard(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID('Lyr '), layer.id);
        var desc = executeActionGet(ref);
        return desc.hasKey(stringIDToTypeID("artboard"));
    } catch(e) {
        return false;
    }
}

function getRootArtboards(doc) {
    var artboards = [];
    for (var i = 0; i < doc.layers.length; i++) {
        if (isArtboard(doc.layers[i])) {
            artboards.push(doc.layers[i]);
        }
    }
    return artboards;
}

function getParentArtboard(layer) {
    var currentLayer = layer;
    while (currentLayer && currentLayer.typename !== "Document") {
        if (isArtboard(currentLayer)) {
            return currentLayer;
        }
        currentLayer = currentLayer.parent;
    }
    return null;
}

function scaleLayerAM(layer, percent) {
    app.activeDocument.activeLayer = layer;
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated( charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt') );
    desc.putReference( charIDToTypeID('null'), ref );
    desc.putEnumerated( charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), stringIDToTypeID("QCSAverage") );
    var offsetDesc = new ActionDescriptor();
    offsetDesc.putUnitDouble( charIDToTypeID('Hrzn'), charIDToTypeID('#Pxl'), 0.000000 );
    offsetDesc.putUnitDouble( charIDToTypeID('Vrtc'), charIDToTypeID('#Pxl'), 0.000000 );
    desc.putObject( charIDToTypeID('Ofst'), charIDToTypeID('Ofst'), offsetDesc );
    desc.putUnitDouble( charIDToTypeID('Wdth'), charIDToTypeID('#Prc'), percent );
    desc.putUnitDouble( charIDToTypeID('Hght'), charIDToTypeID('#Prc'), percent );
    desc.putBoolean( charIDToTypeID('Lnkd'), true );
    executeAction( charIDToTypeID('Trnf'), desc, DialogModes.NO );
}

function processResizeWholeDocument(doc, originalUnit) {
    app.preferences.rulerUnits = Units.PIXELS;
    
    var currentWidth = doc.width.value;
    var currentHeight = doc.height.value;

    var userInput = prompt("어떤 사이즈(가로px)로 수정하겠습니까?\n수치를 입력하시면 비율에 맞게 전체 작업물(이미지, 텍스트, 마진 등)이 조절됩니다.\n\n현재 가로 사이즈: " + Math.round(currentWidth) + "px", Math.round(currentWidth), "전체 크기 비율 조절");

    if (userInput === null || userInput === "") {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var newWidth = parseFloat(userInput);

    if (isNaN(newWidth) || newWidth <= 0) {
        alert("올바른 숫자(양수)를 입력해주세요.");
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    if (newWidth === currentWidth) {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var ratio = currentHeight / currentWidth;
    var newHeight = newWidth * ratio;

    try {
        doc.resizeImage(UnitValue(newWidth, "px"), UnitValue(newHeight, "px"), doc.resolution, ResampleMethod.BICUBIC);
        alert("가로 " + Math.round(newWidth) + "px 로 모든 요소의 비율 조정이 완료되었습니다.");
    } catch (e) {
        alert("사이즈 조절 중 오류가 발생했습니다: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalUnit;
    }
}

function processResizeSingleArtboard(doc, artboardLayer, originalUnit) {
    app.preferences.rulerUnits = Units.PIXELS;
    
    var bounds = artboardLayer.bounds; 
    var currentWidth = bounds[2].value - bounds[0].value;
    
    var userInput = prompt("선택된 아트보드: [" + artboardLayer.name + "]\n어떤 사이즈(가로px)로 수정하겠습니까?\n수치를 입력하시면 비율에 맞게 아트보드 내 모든 작업물이 조절됩니다.\n\n현재 가로 사이즈: " + Math.round(currentWidth) + "px", Math.round(currentWidth), "아트보드 크기 비율 조절");

    if (userInput === null || userInput === "") {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var newWidth = parseFloat(userInput);

    if (isNaN(newWidth) || newWidth <= 0) {
        alert("올바른 숫자(양수)를 입력해주세요.");
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    if (newWidth === currentWidth) {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var percent = (newWidth / currentWidth) * 100;

    try {
        scaleLayerAM(artboardLayer, percent);
        alert("아트보드 [" + artboardLayer.name + "] 가로 " + Math.round(newWidth) + "px 로 조절이 완료되었습니다.");
    } catch (e) {
        alert("사이즈 조절 중 오류가 발생했습니다: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalUnit;
    }
}

function showPalette(doc, originalUnit) {
    globalArtboardPalette = new Window("palette", "아트보드 선택", undefined, {closeButton: true});
    var w = globalArtboardPalette;
    w.orientation = "column";
    w.alignChildren = "center";
    w.margins = 20;
    
    var textGroup = w.add("group");
    textGroup.orientation = "column";
    textGroup.alignChildren = "center";
    textGroup.add("statictext", undefined, "사이즈를 조정할 아트보드를 선택해주세요.");
    textGroup.add("statictext", undefined, "(캔버스에서 아트보드를 클릭한 후 아래 [선택 완료] 클릭)");
    
    var btnGroup = w.add("group");
    btnGroup.margins.top = 10;
    var btnOk = btnGroup.add("button", undefined, "선택 완료");
    var btnCancel = btnGroup.add("button", undefined, "취소");
    
    btnOk.onClick = function() {
        w.close();
        
        var targetArtboard = getParentArtboard(app.activeDocument.activeLayer);
        if (!targetArtboard) {
            alert("선택된 아트보드가 없습니다.\n다시 실행하여 조절할 아트보드를 정확히 선택해주세요.");
            app.preferences.rulerUnits = originalUnit;
            return;
        }
        
        processResizeSingleArtboard(app.activeDocument, targetArtboard, originalUnit);
    };
    
    btnCancel.onClick = function() {
        w.close();
        app.preferences.rulerUnits = originalUnit;
    };
    
    w.show();
}

function main() {
    if (app.documents.length === 0) {
        alert("열려있는 문서가 없습니다.");
        return;
    }

    var doc = app.activeDocument;
    var originalUnit = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    var artboards = getRootArtboards(doc);

    if (artboards.length > 1) {
        showPalette(doc, originalUnit);
    } else {
        processResizeWholeDocument(doc, originalUnit);
    }
}

main();
