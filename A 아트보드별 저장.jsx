#target photoshop
app.displayDialogs = DialogModes.NO;

function getDateStringFallback() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = ("0" + (now.getMonth() + 1)).slice(-2);
    var dd = ("0" + now.getDate()).slice(-2);
    return yy + mm + dd;
}

function getDateString(doc) {
    try {
        var parentFolder = doc.path.parent;
        var proposalFolder = new Folder(parentFolder + "/첨부/기획서");

        if (proposalFolder.exists) {
            var files = proposalFolder.getFiles(function (f) {
                return (f instanceof File) && f.name.match(/\.pptx?$/i);
            });

            if (files.length > 0) {
                var fileName = decodeURI(files[0].name);
                var match = fileName.match(/^(\d+)/);
                if (match) {
                    return match[1]; // 연속된 숫자(날짜) 반환
                }
            }
        }
    } catch (e) {
        // 파일이 아직 저장되지 않았거나 폴더가 없는 경우 무시하고 현재 날짜로 폴백
    }
    return getDateStringFallback();
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
    var dateStr = getDateString(doc);
    var artboards = [];

    for (var i = 0; i < doc.layerSets.length; i++) {
        if (isArtboard(doc.layerSets[i])) {
            artboards.push(doc.layerSets[i]); // 레이어 객체 자체를 저장
        }
    }

    if (artboards.length === 0) {
        alert("아트보드가 없습니다.");
    } else {
        var saveFolder = doc.path || Folder.desktop;

        // 이름 등장 횟수를 추적하는 객체
        var nameCountMap = {};

        // 1패스: 각 이름이 몇 번 등장하는지 미리 카운트
        for (var i = 0; i < artboards.length; i++) {
            var n = artboards[i].name;
            nameCountMap[n] = (nameCountMap[n] || 0) + 1;
        }

        // 저장 시 순서대로 번호 부여를 위한 누적 카운터
        var nameIndexMap = {};

        for (var i = 0; i < artboards.length; i++) {
            var abLayer = artboards[i];
            var abName = abLayer.name;

            var size = getArtboardRect(abLayer);
            var sizeStr = (size.width === 860 && size.height >= 2000) ? "860px" : (size.width + "x" + size.height + "px");
            var cleanName = abName.replace(/\s+/g, "");

            // 같은 이름이 2개 이상이면 _01, _02... 형식으로 번호 추가
            var suffix = "";
            if (nameCountMap[abName] > 1) {
                nameIndexMap[abName] = (nameIndexMap[abName] || 0) + 1;
                var idx = nameIndexMap[abName];
                suffix = "_" + (idx < 10 ? "0" + idx : String(idx));
            }

            var filename = dateStr + "_" + cleanName + suffix + "_" + sizeStr + ".psd";
            var dupTitle = dateStr + "_" + cleanName + suffix;

            var dupDoc = doc.duplicate(dupTitle);

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
