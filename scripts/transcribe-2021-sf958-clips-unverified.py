#!/usr/bin/env python3
"""Optional unverified ASR index for six fixed SF958 source-hash-verified clips.
NEVER speaker diarization, stance adjudication, or as-of publication proof.
A transcript is only a machine-generated hint for subsequent human/audio review.
"""
import json
import os
from pathlib import Path

def main():
    base = Path(os.environ.get("VOTEPREDICT_SF958_EXCERPTS_DIR", ""))
    if not str(base).startswith("artifacts/"):
        raise RuntimeError("Only the fixed review artifact directory is allowed")
    manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != "sf958-2021-public-audio-excerpt-review-v1":
        raise RuntimeError("Unrecognized original-audio review artifact")
    if len(manifest["clips"]) != 6:
        raise RuntimeError("Unexpected reviewed clip count")
    from faster_whisper import WhisperModel
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    results = []
    for clip in manifest["clips"]:
        name = clip["file"]
        if Path(name).name != name or not name.endswith(".mp3"):
            raise RuntimeError("Unexpected clip name")
        segments, info = model.transcribe(str(base / name), language="en", beam_size=1,
                                         vad_filter=False, condition_on_previous_text=False)
        segments = list(segments)
        results.append({
            "clipFile": name,
            "sourceId": clip["sourceId"],
            "startOriginalSeconds": clip["startSeconds"],
            "durationSeconds": clip["durationSeconds"],
            "language": info.language,
            "wordingMayBeWrong": True,
            "speakerIdentityUnknown": True,
            "directionUnknown": True,
            "historicalPreVotePublicationUnproven": True,
            "usableEvidence": False,
            "machineGeneratedSegments": [
                {"clipOffsetStart": round(x.start,2), "clipOffsetEnd": round(x.end,2),
                 "text": x.text.strip()} for x in segments
            ]
        })
    out = {
        "schema": "sf958-machine-asr-candidate-index-v1",
        "model": "faster-whisper tiny.en CPU int8",
        "verifiedHumanTranscript": False,
        "recognizedMember": False,
        "acceptedDirectionalRows": 0,
        "items": results,
    }
    (base / "unverified-machine-transcript.json").write_text(
        json.dumps(out, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"clipsTranscribed":len(results),"acceptedDirectionalRows":0,
                      "speakerAttributionVerified":False}))

if __name__ == "__main__":
    main()
