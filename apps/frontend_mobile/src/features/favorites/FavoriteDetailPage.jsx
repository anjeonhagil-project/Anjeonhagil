import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { hasSelectedLocation } from '../../lib/placeSelection.js'
import { Button, Input, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import BottomNav from '../../components/layout/BottomNav.jsx'
import { deleteFavorite, getFavorites, updateFavorite } from './api.js'
import styles from './FavoritesPage.module.css'
import { getFavoriteName } from './favoriteName.js'
import { buildFavoriteLocationSelection } from './favoriteContract.js'

function FavoriteDetailPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const replacement = hasSelectedLocation(location.state?.selectedPlace) ? location.state.selectedPlace : null
    const draftName = location.state?.draftName
    const { favoriteId } = useParams()
    const [favorite, setFavorite] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [name, setName] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [confirmingEdit, setConfirmingEdit] = useState(false)
    const [deleted, setDeleted] = useState(false)
    const [actionError, setActionError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        let active = true

        getFavorites()
            .then((favorites) => {
                const found = favorites?.find((item) => item.id === favoriteId)
                if (!found) throw new Error('즐겨찾기를 찾을 수 없습니다')
                if (active) {
                    setFavorite(found)
                    setName(typeof draftName === 'string' ? draftName : getFavoriteName(found))
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.message)
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [favoriteId, draftName])

    const handleSave = async () => {
        if (!confirmingEdit || !favorite || !name.trim() || submitting) return

        setSubmitting(true)
        setActionError('')
        try {
            await updateFavorite(favorite.id, {
                customName: name.trim(),
                ...(replacement ? {
                    placeName: replacement.placeName,
                    address: replacement.address,
                    latitude: replacement.latitude,
                    longitude: replacement.longitude,
                    providerPlaceId: replacement.providerPlaceId,
                } : {}),
            })
            navigate('/favorites', { replace: true })
        } catch (requestError) {
            setConfirmingEdit(false)
            setActionError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleting || !favorite || submitting) return

        setSubmitting(true)
        setActionError('')
        try {
            await deleteFavorite(favorite.id)
            setDeleting(false)
            setDeleted(true)
        } catch (requestError) {
            setDeleting(false)
            setActionError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <p className={styles.message}>즐겨찾기를 불러오는 중입니다.</p>
    if (error || !favorite) {
        return (
            <div className={styles.page} data-page="favorite-detail">
                <Header title="즐겨찾기 상세" onBack={() => navigate('/favorites')} />
                <p className={styles.error}>{error || '즐겨찾기를 찾을 수 없습니다'}</p>
                <BottomNav />
            </div>
        )
    }

    return (
        <div className={styles.page} data-page="favorite-detail">
            <Header title="즐겨찾기 수정" onBack={() => navigate('/favorites')} />
            <main className={`${styles.detailContent} hide-scrollbar`}>
                <section className={styles.savedPlaceCard} aria-label="저장한 장소">
                    <div className={styles.savedPlaceHeading}>
                        <strong>{replacement?.placeName || favorite.placeName}</strong>
                        <button type="button" className={styles.textAction} disabled={submitting || deleted} onClick={() => {
                            const destination = buildFavoriteLocationSelection({
                                favoriteId: favorite.id,
                                placeType: favorite.placeType,
                                draftName: name,
                            })
                            navigate(destination.to, { state: destination.state })
                        }}>위치 수정</button>
                    </div>
                    <p>{replacement?.address || favorite.address}</p>
                    {replacement && <p>새 위치를 선택했어요. 변경사항 저장을 눌러 확정해주세요.</p>}
                </section>
                <div className={styles.detailForm}>
                    <Input label="새 이름" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="즐겨찾기 이름을 입력해주세요" disabled={submitting || deleted} />
                </div>
                {actionError && <p className={styles.error} role="alert">{actionError}</p>}

                <div className={styles.detailActions}>
                    <Button fullWidth onClick={() => setConfirmingEdit(true)} disabled={!name.trim() || (!replacement && name.trim() === getFavoriteName(favorite)) || submitting || deleted}>
                        {replacement ? '변경사항 저장' : '이름 변경'}
                    </Button>
                    <Button fullWidth variant="secondary" onClick={() => setDeleting(true)} disabled={submitting || deleted}>삭제</Button>
                </div>
            </main>
            <BottomNav />

            <Modal
                open={confirmingEdit}
                icon="edit"
                title={replacement ? '즐겨찾기 위치 변경' : '즐겨찾기 이름 변경'}
                description={replacement ? '선택한 위치로 즐겨찾기를 수정하시겠습니까?' : '즐겨찾기 이름을 수정하시겠습니까?'}
                cancelLabel="취소"
                onCancel={() => setConfirmingEdit(false)}
                confirmLabel={submitting ? '변경 중...' : '변경'}
                onConfirm={handleSave}
                pending={submitting}
            />

            <Modal
                open={deleting}
                icon="warning"
                title="즐겨찾기 삭제"
                description="저장한 장소를 삭제하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setDeleting(false)}
                confirmLabel={submitting ? '삭제 중...' : '삭제'}
                onConfirm={handleDelete}
                pending={submitting}
                danger
            />
            <Modal
                open={deleted}
                icon="success"
                title="삭제 완료"
                description="즐겨찾기가 삭제되었습니다."
                confirmLabel="확인"
                onConfirm={() => navigate('/favorites', { replace: true })}
            />

        </div>
    )
}

export default FavoriteDetailPage
