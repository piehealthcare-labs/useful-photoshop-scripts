function deleteHiddenLayers(layerContainer) {
  for (var i = layerContainer.artLayers.length - 1; i >= 0; i--) {
    var layer = layerContainer.artLayers[i];
    if (!layer.visible) {
      layer.allLocked = false; // 잠금 해제
      layer.remove();
    }
  }

  for (var j = layerContainer.layerSets.length - 1; j >= 0; j--) {
    var group = layerContainer.layerSets[j];
    if (!group.visible) {
      group.allLocked = false; // 잠금 해제
      group.remove();
    } else {
      deleteHiddenLayers(group); // 내부 재귀 호출
    }
  }
}

if (app.documents.length > 0) {
  var doc = app.activeDocument;
  app.activeDocument.suspendHistory("숨겨진 레이어 삭제", "deleteHiddenLayers(doc)");
} else {
  alert("열린 문서가 없습니다.");
}
