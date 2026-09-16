// 기능(Anjeonhagil): 실제 표시한 후보 순서를 한 번 기록하고 선택 전 노출 ID를 제공한다.
import { useEffect, useRef, useState } from 'react'
import { recordRouteExposure } from './api.js'

export function useRouteExposure({ searchId, candidateIds, recommendedCandidateId = null, enabled = true }) {
    const requestRef = useRef(null)
    const [exposure, setExposure] = useState(null)
    const [error, setError] = useState('')
    const signature = searchId && candidateIds?.length
        ? `${searchId}:${candidateIds.join(',')}:${recommendedCandidateId ?? ''}`
        : ''

    useEffect(() => {
        if (!enabled || !signature) return undefined
        if (!requestRef.current || requestRef.current.signature !== signature) {
            requestRef.current = { signature, exposureId: crypto.randomUUID() }
        }

        let cancelled = false
        const request = requestRef.current
        setExposure(null)
        setError('')
        recordRouteExposure(searchId, {
            exposureId: request.exposureId,
            candidateIds,
            recommendedCandidateId,
        })
            .then((result) => !cancelled && setExposure(result))
            .catch((requestError) => !cancelled && setError(requestError.message || '경로 노출을 기록하지 못했습니다.'))

        return () => { cancelled = true }
    }, [enabled, signature])

    return {
        exposureId: exposure?.exposureId ?? null,
        isRecorded: Boolean(exposure),
        error,
    }
}
