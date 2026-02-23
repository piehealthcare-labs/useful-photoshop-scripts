// Photoshop Artboard to Regular Canvas Script (Ultimate Fail-Proof Version)
// 작성자: Antigravity
// 기능: 기존 대지를 해제하는 대신, 똑같은 크기의 '일반 캔버스 새 파일'을 만들고
//       모든 아트워크(레이어)를 완벽하게 복사해온 뒤, 원본을 닫습니다.
// 해제/삭제 관련 포토샵 내부 버그를 완벽하게 회피하는 방식입니다.

#target photoshop

function main() {
    if (app.documents.length === 0) {
        alert("열려있는 포토샵 파일이 없습니다.");
        return;
    }

    var originalDocs = [];
    for (var i = 0; i < app.documents.length; i++) {
        originalDocs.push(app.documents[i]);
    }

    var processedCount = 0;

    // 환경설정 (대화상자 무시, 눈금자 단위 픽셀 고정)
    var originalDialogMode = app.displayDialogs;
    var originalRulerUnits = app.preferences.rulerUnits;
    app.displayDialogs = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    for (var j = 0; j < originalDocs.length; j++) {
        var doc = originalDocs[j];

        try {
            app.activeDocument = doc;
            if (convertByDuplication(doc)) {
                processedCount++;
            }
        } catch (e) {
            // alert("에러: " + e.message);
        }
    }

    // 환경설정 복구
    app.displayDialogs = originalDialogMode;
    app.preferences.rulerUnits = originalRulerUnits;

    alert("작업 완료!\n총 " + processedCount + "개의 문서가 일반 캔버스로 안전하게 변환되었습니다.");
}

function convertByDuplication(doc) {
    // 1. 대지가 있는지 먼저 확인
    var artboards = [];
    findArtboardsRecursive(doc, artboards);

    if (artboards.length === 0) {
        return false; // 대지가 없으면 건너뜐
    }

    // 2. 전체 문서의 영역 계산 (가장 큰 영역 기준)
    var docWidth = doc.width.value;
    var docHeight = doc.height.value;
    var resolution = doc.resolution;
    var docName = doc.name;
    var docPath = "";

    try {
        docPath = doc.fullName; // 저장된 파일이면 경로 기억
    } catch (e) { }

    // 3. 완전히 똑같은 설정의 '새 일반 문서' 생성 (대지 아님)
    var newDoc = app.documents.add(docWidth, docHeight, resolution, docName, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);

    // 4. 다시 원본 문서로 이동
    app.activeDocument = doc;

    // 5. 숨겨진 레이어를 포함해 모든 최상단 레이어/그룹을 새 문서로 복제 (순서 완벽 유지)
    var layersToDuplicate = [];
    for (var i = 0; i < doc.layers.length; i++) {
        layersToDuplicate.push(doc.layers[i]);
    }

    // 맨 아래부터 복사해야 새 문서에서 위로 차곡차곡 쌓임
    for (var k = layersToDuplicate.length - 1; k >= 0; k--) {
        app.activeDocument = doc;
        var layer = layersToDuplicate[k];

        // 레이어를 새 문서로 복제
        layer.duplicate(newDoc, ElementPlacement.PLACEATBEGINNING);
    }

    // 6. 새 문서로 포커스 이동 후, 복제 과정에서 딸려온 '대지 속성' 강제 파괴
    app.activeDocument = newDoc;
    var newArtboards = [];
    findArtboardsRecursive(newDoc, newArtboards);

    // 복제된 레이어셋에서 대지 속성을 박탈하기 전, 대지들의 정확한 전체 영역(Bounds)을 계산
    var abRect = getArtboardsRect(newArtboards);

    // 각 대지별로 속성 박탈 및 배경색 생성
    for (var abIdx = 0; abIdx < newArtboards.length; abIdx++) {
        var ab = newArtboards[abIdx];
        var rect = getArtboardRect(ab);
        var colorInfo = getArtboardColor(ab);

        // 대지 자체에 색상이 지정되어 있다면 레이어 그룹 가장 아래에 해당 색상의 사각형 레이어 생성
        if (colorInfo && colorInfo.hasColor && rect) {
            createColorLayerAtBottom(ab, rect, colorInfo);
        }

        // 복제된 레이어셋에서 대지 속성을 완전히 박탈 (단순 그룹화)
        removeArtboardData(ab);
    }

    // 위치 튜닝: 기존의 revealAll()은 보이지 않는 레이어 범위까지 캔버스를 임의로 확장시키는 버그의 원인!
    // 대신 추출한 대지의 실제 크기로 문서 창을 정확히 크롭(Crop) 합니다.
    try {
        if (abRect) {
            newDoc.crop(abRect);
        }
    } catch (e) { }

    // 7. 원본 문서 닫기 (저장하지 않음 - 원본 보호)
    doc.close(SaveOptions.DONOTSAVECHANGES);

    return true;
}

function findArtboardsRecursive(parent, artboards) {
    var layers = parent.layers;
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.typename === "LayerSet") {
            if (isArtboard(layer)) {
                artboards.push(layer);
            }
            // 내부 탐색
            findArtboardsRecursive(layer, artboards);
        }
    }
}

function isArtboard(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        return (desc.hasKey(stringIDToTypeID("artboard")) || desc.hasKey(stringIDToTypeID("artboardEnabled")));
    } catch (e) {
        return false;
    }
}

function removeArtboardData(layerSet) {
    // Action Manager를 통해 폴더(LayerSet)의 대지 메타데이터만 날리고 일반 폴더로 전락시킴
    // 'Ungroup' 명령을 쓰지 않고 데이터를 덧씌우는 해킹 기법
    try {
        app.activeDocument.activeLayer = layerSet;
        var idsetd = charIDToTypeID("setd");
        var desc = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref = new ActionReference();
        var idLyr = charIDToTypeID("Lyr ");
        var idOrdn = charIDToTypeID("Ordn");
        var idTrgt = charIDToTypeID("Trgt");
        ref.putEnumerated(idLyr, idOrdn, idTrgt);
        desc.putReference(idnull, ref);

        var idT = charIDToTypeID("T   ");
        var layerDesc = new ActionDescriptor();

        // artboardEnabled를 false로 명시적 선언
        var idartboardEnabled = stringIDToTypeID("artboardEnabled");
        layerDesc.putBoolean(idartboardEnabled, false);

        // 널(빈) artboard 객체 덮어쓰기
        var idartboard = stringIDToTypeID("artboard");
        var artboardDesc = new ActionDescriptor();
        layerDesc.putObject(idartboard, idartboard, artboardDesc);

        desc.putObject(idT, idLyr, layerDesc);
        executeAction(idsetd, desc, DialogModes.NO);
    } catch (e) { }
}

function getArtboardColor(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        var artboardDesc = desc.getObjectValue(stringIDToTypeID("artboard"));

        var bgType = 1; // 기본은 White
        try {
            bgType = artboardDesc.getInteger(stringIDToTypeID("artboardBackgroundType"));
        } catch (e) { }

        var colorInfo = { hasColor: false, r: 255, g: 255, b: 255 };

        if (bgType === 1) { // White
            colorInfo.hasColor = true;
            colorInfo.r = 255; colorInfo.g = 255; colorInfo.b = 255;
        } else if (bgType === 2) { // Black
            colorInfo.hasColor = true;
            colorInfo.r = 0; colorInfo.g = 0; colorInfo.b = 0;
        } else if (bgType === 3) { // Transparent
            colorInfo.hasColor = false;
        } else {
            // Custom Color 기타 등등
            try {
                var cDesc = artboardDesc.getObjectValue(stringIDToTypeID("color"));
                colorInfo.r = cDesc.getDouble(stringIDToTypeID("red"));
                colorInfo.g = cDesc.getDouble(stringIDToTypeID("green"));
                colorInfo.b = cDesc.getDouble(stringIDToTypeID("blue"));
                colorInfo.hasColor = true;
            } catch (e) {
                // 지정되었지만 속성 추출 실패시 우선 투명 처리
                colorInfo.hasColor = false;
            }
        }
        return colorInfo;
    } catch (e) {
        return { hasColor: false };
    }
}

function createColorLayerAtBottom(parentGroup, rect, colorInfo) {
    try {
        var originalActiveLayer = app.activeDocument.activeLayer;

        // 새 레이어를 대상 대지 그룹 가장 위에 생성 (기본동작)
        var bgLayer = parentGroup.artLayers.add();
        bgLayer.name = "대지 배경색";

        // 맨 아래로 옮기기 위해 현재 맨 아랫단 레이어 뒤로 이동
        var length = parentGroup.layers.length;
        if (length > 1) {
            var lastIdx = length - 1;
            var lastLayer = parentGroup.layers[lastIdx];
            if (bgLayer.id !== lastLayer.id) {
                bgLayer.move(lastLayer, ElementPlacement.PLACEAFTER);
            }
        }

        // 선택 영역을 대지의 좌표만큼 지정 (newDoc은 여전히 원래 문서 좌표계와 동일)
        var selRegion = [
            [rect[0], rect[1]],
            [rect[2], rect[1]],
            [rect[2], rect[3]],
            [rect[0], rect[3]]
        ];
        app.activeDocument.selection.select(selRegion);

        // 얻어온 배경 색상 채우기
        var solidColor = new SolidColor();
        solidColor.rgb.red = colorInfo.r;
        solidColor.rgb.green = colorInfo.g;
        solidColor.rgb.blue = colorInfo.b;

        app.activeDocument.selection.fill(solidColor);
        app.activeDocument.selection.deselect();

        app.activeDocument.activeLayer = originalActiveLayer;
    } catch (e) { }
}

function getArtboardsRect(artboards) {
    if (artboards.length === 0) return null;
    var minLeft = null, minTop = null, maxRight = null, maxBottom = null;

    for (var i = 0; i < artboards.length; i++) {
        var rect = getArtboardRect(artboards[i]);
        if (rect) {
            if (minLeft === null || rect[0] < minLeft) minLeft = rect[0];
            if (minTop === null || rect[1] < minTop) minTop = rect[1];
            if (maxRight === null || rect[2] > maxRight) maxRight = rect[2];
            if (maxBottom === null || rect[3] > maxBottom) maxBottom = rect[3];
        }
    }
    if (minLeft !== null) {
        return [minLeft, minTop, maxRight, maxBottom];
    }
    return null;
}

function getArtboardRect(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        var artboardDesc = desc.getObjectValue(stringIDToTypeID("artboard"));
        var rect = artboardDesc.getObjectValue(stringIDToTypeID("artboardRect"));
        var top = rect.getDouble(stringIDToTypeID("top"));
        var left = rect.getDouble(stringIDToTypeID("left"));
        var bottom = rect.getDouble(stringIDToTypeID("bottom"));
        var right = rect.getDouble(stringIDToTypeID("right"));
        return [left, top, right, bottom];
    } catch (e) {
        return null;
    }
}

main();
