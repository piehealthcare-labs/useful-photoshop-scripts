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

    var userInput = prompt("\uC5B4\uB5A4 \uC0AC\uC774\uC988(\uAC00\uB85Cpx)\uB85C \uC218\uC815\uD558\uACA0\uC2B5\uB2C8\uAE4C?\n\uC218\uCE58\uB97C \uC785\uB825\uD558\uC2DC\uBA74 \uBE44\uC728\uC5D0 \uB9DE\uAC8C \uC804\uCCB4 \uC791\uC5C5\uBB3C(\uC774\uBBF8\uC9C0, \uD14D\uC2A4\uD2B8, \uB9C8\uC9C4 \uB4F1)\uC774 \uC870\uC808\uB429\uB2C8\uB2E4.\n\n\uD604\uC7AC \uAC00\uB85C \uC0AC\uC774\uC988: " + Math.round(currentWidth) + "px", Math.round(currentWidth), "\uC804\uCCB4 \uD06C\uAE30 \uBE44\uC728 \uC870\uC808");

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

    try {
        doc.resizeImage(UnitValue(newWidth, "px"), UnitValue(newHeight, "px"), doc.resolution, ResampleMethod.BICUBIC);
        alert("\uAC00\uB85C " + Math.round(newWidth) + "px \uB85C \uBAA8\uB4E0 \uC694\uC18C\uC758 \uBE44\uC728 \uC870\uC815\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (e) {
        alert("\uC0AC\uC774\uC988 \uC870\uC808 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: " + e.message);
    } finally {
        app.preferences.rulerUnits = originalUnit;
    }
}

function showUnifiedDialogAndProcess(doc, originalUnit, artboards, targetArtboard) {
    app.preferences.rulerUnits = Units.PIXELS;
    var w = new Window("dialog", "\uC544\uD2B8\uBCF4\uB4DC \uD06C\uAE30 \uC870\uC808");
    w.orientation = "column";
    w.alignChildren = "fill";
    w.margins = 20;
    
    var panel1 = w.add("panel", undefined, "\uB300\uC0C1 \uC544\uD2B8\uBCF4\uB4DC");
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
    
    var panel2 = w.add("panel", undefined, "\uC0AC\uC774\uC988 \uC218\uC815 (\uAC00\uB85C px)");
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
    
    var btnGroup = w.add("group");
    btnGroup.alignment = "center";
    btnGroup.margins.top = 10;
    var btnOk = btnGroup.add("button", undefined, "\uD655\uC778", {name: "ok"});
    var btnCancel = btnGroup.add("button", undefined, "\uCDE8\uC18C", {name: "cancel"});
    
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
        w.close(1);
    };
    
    btnCancel.onClick = function() {
        w.close(0);
    };
    
    w.onShow = function() {
        sizeInput.active = true;
    };
    
    if (w.show() === 1) {
        var currentWidth = getArtboardWidth(selectedAb);
        if (resultWidth !== Math.round(currentWidth)) {
            var percent = (resultWidth / currentWidth) * 100;
            try {
                scaleLayerAM(selectedAb, percent);
                alert("\uC544\uD2B8\uBCF4\uB4DC [" + selectedAb.name + "] \uAC00\uB85C " + Math.round(resultWidth) + "px \uB85C \uC870\uC808\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
            } catch(e) {
                alert("\uC0AC\uC774\uC988 \uC870\uC808 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: " + e.message);
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
