#target photoshop
app.displayDialogs = DialogModes.NO;

function getDateString() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = ("0" + (now.getMonth() + 1)).slice(-2);
    var dd = ("0" + now.getDate()).slice(-2);
    return yy + mm + dd;
}

function isArtboard(layerSet) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), layerSet.id);
        var desc = executeActionGet(ref);
        return desc.hasKey(stringIDToTypeID("artboard"));
    } catch (e) {
        return false;
    }
}

function getArtboardRect(layerSet) {
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), layerSet.id);
    var desc = executeActionGet(ref);
    var abDesc = desc.getObjectValue(stringIDToTypeID("artboard"));
    var rect = abDesc.getObjectValue(stringIDToTypeID("artboardRect"));
    var left = rect.getUnitDoubleValue(stringIDToTypeID("left"));
    var top = rect.getUnitDoubleValue(stringIDToTypeID("top"));
    var right = rect.getUnitDoubleValue(stringIDToTypeID("right"));
    var bottom = rect.getUnitDoubleValue(stringIDToTypeID("bottom"));
    return {
        width: Math.round(right - left),
        height: Math.round(bottom - top)
    };
}

// 레이어셋 내부의 모든 레이어 잠금 해제
function unlockAllLayers(layerSet) {
    for (var i = 0; i < layerSet.artLayers.length; i++) {
        layerSet.artLayers[i].allLocked = false;
    }
    for (var j = 0; j < layerSet.layerSets.length; j++) {
        unlockAllLayers(layerSet.layerSets[j]); // 재귀
    }
    layerSet.allLocked = false;
}

if (app.documents.length === 0) {
    alert("열려 있는 문서가 없습니다.");
} else {
    var doc = app.activeDocument;
    var dateStr = getDateString();
    var artboards = [];

    for (var i = 0; i < doc.layerSets.length; i++) {
        if (isArtboard(doc.layerSets[i])) {
            artboards.push(doc.layerSets[i].name);
        }
    }

    if (artboards.length === 0) {
        alert("아트보드가 없습니다.");
    } else {
        var saveFolder = doc.path || Folder.desktop;

        for (var i = 0; i < artboards.length; i++) {
            var abName = artboards[i];
            var abLayer = null;

            for (var j = 0; j < doc.layerSets.length; j++) {
                if (doc.layerSets[j].name === abName && isArtboard(doc.layerSets[j])) {
                    abLayer = doc.layerSets[j];
                    break;
                }
            }

            if (!abLayer) continue;

            var size = getArtboardRect(abLayer);
            var sizeStr = size.width + "x" + size.height + "px";
            var cleanName = abName.replace(/\s+/g, "");
            var filename = dateStr + "_" + cleanName + "_" + sizeStr + ".psd";

            var dupDoc = doc.duplicate(dateStr + "_" + cleanName);

            for (var k = dupDoc.layerSets.length - 1; k >= 0; k--) {
                var ls = dupDoc.layerSets[k];
                if (isArtboard(ls) && ls.name !== abName) {
                    unlockAllLayers(ls); // ✅ 잠금 해제
                    ls.remove();         // ✅ 삭제
                }
            }

            var saveFile = new File(saveFolder + "/" + filename);
            var saveOptions = new PhotoshopSaveOptions();
            saveOptions.layers = true;

            dupDoc.saveAs(saveFile, saveOptions, true);
            dupDoc.close(SaveOptions.DONOTSAVECHANGES);
        }

        alert("총 " + artboards.length + "개의 아트보드 PSD가 저장되었습니다.");
    }
}
