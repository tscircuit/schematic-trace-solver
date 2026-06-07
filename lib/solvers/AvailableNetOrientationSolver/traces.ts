def _merge_segments(self, segments):
        """Merge overlapping segments into non-overlapping ones."""
        merged_segments = []
        for segment in segments:
            if not merged_segments:
                merged_segments.append(segment)
                continue
            last_segment = merged_segments[-1]
            if last_segment._start < segment._start:
                merged_segments[-1] = {
                    "start": last_segment._start,
                    "end": segment._start,
                    "label": segment.label,
                }
                continue
            if last_segment._end < segment._start:
                merged_segments.append(segment)
                continue
            merged_segments[-1] = {
                "start": last_segment._start,
                "end": segment._start,
                "label": segment.label,
            }
        return merged_segments

    def _split_segments_by_start(self, segments):
        """Split segments based on their start positions."""
        new_segments = []
        for segment in segments:
            if segment._start < 0:
                new_segments.append(segment)
            else:
                new_segments.append({
                    "start": segment._start,
                    "end": segment._start + segment._length,
                    "label": segment.label,
                })
        return new_segments

    def _merge_segments_by_start(self, segments):
        """Merge overlapping segments based on their start positions."""
        merged_segments = []
        for segment in segments:
            if not merged_segments:
                merged_segments.append(segment)
                continue