#target photoshop

app.bringToFront();

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

function getArtboardWidth(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
        var desc = executeActionGet(ref);
        var abDesc = desc.getObjectValue(stringIDToTypeID("artboard"));
        var rect = abDesc.getObjectValue(stringIDToTypeID("artboardRect"));
        var left = rect.getUnitDoubleValue(stringIDToTypeID("left"));
        var right = rect.getUnitDoubleValue(stringIDToTypeID("right"));
        return right - left;
    } catch (e) {
        var bounds = layer.bounds;
        return bounds[2].value - bounds[0].value;
    }
}

// 구버전 호환: FTcs/QCSAverage/Ofst 파라미터 제거
function scaleLayerAM(layer, percent) {
    app.activeDocument.activeLayer = layer;
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated( charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt') );
    desc.putReference( charIDToTypeID('null'), ref );
    desc.putUnitDouble( charIDToTypeID('Wdth'), charIDToTypeID('#Prc'), percent );
    desc.putUnitDouble( charIDToTypeID('Hght'), charIDToTypeID('#Prc'), percent );
    desc.putBoolean( charIDToTypeID('Lnkd'), true );
    executeAction( charIDToTypeID('Trnf'), desc, DialogModes.NO );
}

// Action Manager를 사용한 이미지 리사이즈 (구버전 호환)
function resizeImageAM(newWidth, newHeight, resolution) {
    var desc = new ActionDescriptor();
    desc.putUnitDouble( charIDToTypeID('Wdth'), charIDToTypeID('#Pxl'), newWidth );
    desc.putUnitDouble( charIDToTypeID('Hght'), charIDToTypeID('#Pxl'), newHeight );
    desc.putUnitDouble( charIDToTypeID('Rslt'), charIDToTypeID('#Rsl'), resolution );
    desc.putBoolean( stringIDToTypeID('scaleStyles'), true );
    desc.putBoolean( charIDToTypeID('CnsP'), true );
    // Bicubic resample
    desc.putEnumerated( charIDToTypeID('Intr'), charIDToTypeID('Intp'), charIDToTypeID('Bcbc') );
    executeAction( charIDToTypeID('ImgS'), desc, DialogModes.NO );
}

// doc.width가 UnitValue인 경우와 숫자인 경우 모두 처리
function getDocWidth(doc) {
    var w = doc.width;
    if (typeof w === "object" && w !== null && typeof w.value !== "undefined") {
        return w.value;
    }
    return Number(w);
}

function getDocHeight(doc) {
    var h = doc.height;
    if (typeof h === "object" && h !== null && typeof h.value !== "undefined") {
        return h.value;
    }
    return Number(h);
}

function getDocResolution(doc) {
    var r = doc.resolution;
    if (typeof r === "object" && r !== null && typeof r.value !== "undefined") {
        return r.value;
    }
    return Number(r);
}

function processResizeWholeDocument(doc, originalUnit) {
    app.preferences.rulerUnits = Units.PIXELS;

    var currentWidth = getDocWidth(doc);
    var currentHeight = getDocHeight(doc);

    // 구버전 호환: prompt 3번째 인자(타이틀) 제거
    var userInput = prompt(
        "\uC5B4\uB5A4 \uC0AC\uC774\uC988(\uAC00\uB85Cpx)\uB85C \uC218\uC815\uD558\uACA0\uC2B5\uB2C8\uAE4C?\n\uC218\uCE58\uB97C \uC785\uB825\uD558\uC2DC\uBA74 \uBE44\uC728\uC5D0 \uB9DE\uAC8C \uC804\uCCB4 \uC791\uC5C5\uBB3C(\uC774\uBBF8\uC9C0, \uD14D\uC2A4\uD2B8, \uB9C8\uC9C4 \uB4F1)\uC774 \uC870\uC808\uB429\uB2C8\uB2E4.\n\n\uD604\uC7AC \uAC00\uB85C \uC0AC\uC774\uC988: " + Math.round(currentWidth) + "px",
        Math.round(currentWidth)
    );

    if (userInput === null || userInput === "") {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var newWidth = parseFloat(userInput);

    if (isNaN(newWidth) || newWidth <= 0) {
        alert("\uC62C\uBC14\uB978 \uC22B\uC790(\uC591\uC218)\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.");
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    if (newWidth === currentWidth) {
        app.preferences.rulerUnits = originalUnit;
        return;
    }

    var ratio = currentHeight / currentWidth;
    var newHeight = newWidth * ratio;
    var resolution = getDocResolution(doc);

    try {
        resizeImageAM(newWidth, newHeight, resolution);
        alert("\uAC00\uB85C " + Math.round(newWidth) + "px \uB85C \uBAA8\uB4E0 \uC694\uC18C\uC758 \uBE44\uC728 \uC870\uC815\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (e) {
        alert("\uC0AC\uC774\uC988 \uC870\uC808 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalUnit;
    }
}

function showUnifiedDialogAndProcess(doc, originalUnit, artboards, targetArtboard) {
    app.preferences.rulerUnits = Units.PIXELS;
    var dlg = new Window("dialog", "\uC544\uD2B8\uBCF4\uB4DC \uD06C\uAE30 \uC870\uC808");
    dlg.orientation = "column";
    dlg.alignChildren = "fill";
    dlg.margins = 20;

    var panel1 = dlg.add("panel", undefined, "\uB300\uC0C1 \uC544\uD2B8\uBCF4\uB4DC");
    panel1.orientation = "column";
    panel1.alignChildren = "center";
    panel1.margins = 15;

    var dropdown = panel1.add("dropdownlist", undefined, []);
    var selectedIndex = 0;

    for (var i = 0; i < artboards.length; i++) {
        dropdown.add("item", artboards[i].name);
        if (targetArtboard && artboards[i].name === targetArtboard.name) {
            selectedIndex = i;
        }
    }
    dropdown.selection = selectedIndex;
    dropdown.preferredSize.width = 250;

    var panel2 = dlg.add("panel", undefined, "\uC0AC\uC774\uC988 \uC218\uC815 (\uAC00\uB85C px)");
    panel2.orientation = "column";
    panel2.alignChildren = "center";
    panel2.margins = 15;

    var infoText = panel2.add("statictext", undefined, "\uD604\uC7AC \uAC00\uB85C \uC0AC\uC774\uC988: - px");

    var inputGroup = panel2.add("group");
    var sizeInput = inputGroup.add("edittext", undefined, "");
    sizeInput.preferredSize.width = 100;
    inputGroup.add("statictext", undefined, "px");

    function updateCurrentSize() {
        if (dropdown.selection) {
            var ab = artboards[dropdown.selection.index];
            var w_val = Math.round(getArtboardWidth(ab));
            infoText.text = "\uD604\uC7AC \uAC00\uB85C \uC0AC\uC774\uC988: " + w_val + " px";
            sizeInput.text = w_val;
        }
    }
    dropdown.onChange = updateCurrentSize;
    updateCurrentSize();

    // 구버전 ScriptUI 호환: margins 객체 직접 접근 대신 그룹 사용
    var btnGroup = dlg.add("group");
    btnGroup.alignment = "center";
    // 구버전 ScriptUI는 버튼에 {name:} 옵션 미지원 → 옵션 없이 생성
    var btnOk = btnGroup.add("button", undefined, "\uD655\uC778");
    var btnCancel = btnGroup.add("button", undefined, "\uCDE8\uC18C");

    var resultWidth = null;
    var selectedAb = null;

    btnOk.onClick = function() {
        var val = parseFloat(sizeInput.text);
        if (isNaN(val) || val <= 0) {
            alert("\uC62C\uBC14\uB978 \uC22B\uC790(\uC591\uC218)\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.");
            return;
        }
        resultWidth = val;
        selectedAb = artboards[dropdown.selection.index];
        dlg.close(1);
    };

    btnCancel.onClick = function() {
        dlg.close(0);
    };

    dlg.onShow = function() {
        sizeInput.active = true;
    };

    if (dlg.show() === 1) {
        var currentWidth = getArtboardWidth(selectedAb);
        if (resultWidth !== Math.round(currentWidth)) {
            var percent = (resultWidth / currentWidth) * 100;
            try {
                scaleLayerAM(selectedAb, percent);
                alert("\uC544\uD2B8\uBCF4\uB4DC [" + selectedAb.name + "] \uAC00\uB85C " + Math.round(resultWidth) + "px \uB85C \uC870\uC808\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
            } catch(e) {
                // 아트보드 Transform 실패 시 전체 문서 리사이즈로 폴백
                try {
                    var docW = getDocWidth(doc);
                    var docH = getDocHeight(doc);
                    var docRatio = docH / docW;
                    var newDocH = resultWidth * docRatio;
                    var resolution = getDocResolution(doc);
                    resizeImageAM(resultWidth, newDocH, resolution);
                    alert("\uC804\uCCB4 \uBB38\uC11C \uB9AC\uC0AC\uC774\uC988\uB85C \uCC98\uB9AC\uD588\uC2B5\uB2C8\uB2E4.\n\uAC00\uB85C " + Math.round(resultWidth) + "px \uB85C \uC870\uC808\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
                } catch(e2) {
                    alert("\uC0AC\uC774\uC988 \uC870\uC808 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: " + e2.message);
                }
            }
        }
    }
    app.preferences.rulerUnits = originalUnit;
}

function main() {
    if (app.documents.length === 0) {
        alert("\uC5F4\uB824\uC788\uB294 \uBB38\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return;
    }

    var doc = app.activeDocument;
    var originalUnit = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    var artboards = getRootArtboards(doc);

    var targetArtboard = null;
    try {
        if (isArtboard(doc.activeLayer)) {
            targetArtboard = doc.activeLayer;
        }
    } catch(e) {}

    if (artboards.length > 0) {
        showUnifiedDialogAndProcess(doc, originalUnit, artboards, targetArtboard);
    } else {
        processResizeWholeDocument(doc, originalUnit);
    }
}

main();
