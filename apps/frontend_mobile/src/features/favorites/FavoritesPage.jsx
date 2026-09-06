import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasSelectedLocation } from '../../lib/placeSelection.js'
import { Button, Input, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import BottomNav from '../../components/layout/BottomNav.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { createFavorite, deleteFavorite, getFavorites } from './api.js'
import styles from './FavoritesPage.module.css'
import { getFavoriteName, PLACE_TYPE_LABELS } from './favoriteName.js'
import { buildFavoriteLocationSelection } from './favoriteContract.js'

function FavoritesPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { session, loading: authLoading } = useAuth()
    const [favorites, setFavorites] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [deleteComplete, setDeleteComplete] = useState(false)
    const [deletingFavorite, setDeletingFavorite] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saveForm, setSaveForm] = useState({ placeType: 'custom', placeName: '', customName: '', address: '' })
    const [submitting, setSubmitting] = useState(false)
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        const selectedPlace = location.state?.selectedPlace
        if (!hasSelectedLocation(selectedPlace)) return
        setSaveForm({ ...selectedPlace, placeType: location.state?.placeType || 'custom', customName: '' })
        setSaveError('')
        setSaving(true)
        navigate(location.pathname, { replace: true, state: null })
    }, [location.state, location.pathname, navigate])

    useEffect(() => {
        if (authLoading) return undefined

        if (!session) {
            navigate('/login', { replace: true })
            return undefined
        }

        let active = true

        getFavorites()
            .then((data) => {
                if (active) setFavorites(data ?? [])
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
    }, [authLoading, navigate, session])

    const openSaveModal = (placeType = 'custom') => {
        const destination = buildFavoriteLocationSelection({ placeType })
        navigate(destination.to, { state: destination.state })
    }

    const handleSave = async () => {
        if (!hasSelectedLocation(saveForm) || submitting || loading) return
        if (saveForm.placeType !== 'custom' && favorites.some((favorite) => favorite.placeType === saveForm.placeType)) {
            setSaveError('이미 등록된 분류입니다. 다른 분류를 선택해주세요.')
            return
        }

        setSubmitting(true)
        setSaveError('')
        try {
            const created = await createFavorite({
                ...saveForm,
                customName: saveForm.customName.trim() || PLACE_TYPE_LABELS[saveForm.placeType],
            })
            setFavorites((current) => [...current, created])
            setSaving(false)
        } catch (requestError) {
            setSaveError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleFindRoute = () => {
        navigate('/home')
    }

    const openEditModal = (favorite) => {
        navigate(`/favorites/${favorite.id}`)
    }

    const handleDelete = async () => {
        if (!deletingFavorite || submitting) return

        setSubmitting(true)
        try {
            await deleteFavorite(deletingFavorite.id)
            setFavorites((current) => current.filter((favorite) => favorite.id !== deletingFavorite.id))
            setDeletingFavorite(null)
            setDeleteComplete(true)
        } catch (requestError) {
            setDeletingFavorite(null)
            setError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.page} data-page="favorites">
            <Header title="즐겨찾기" onBack={() => window.history.back()} />
            <main className={styles.content}>
                <section className={styles.frequentSection}>
                    <h2>자주 가는 곳</h2>
                    <div className={styles.frequentList}>
                        {['home', 'work'].map((placeType) => {
                            const favorite = favorites.find((item) => item.placeType === placeType)
                            return (
                                <article
                                    className={[styles.frequentItem, favorite ? styles.clickable : ''].filter(Boolean).join(' ')}
                                    key={placeType}
                                    onClick={() => favorite && navigate(`/favorites/${favorite.id}`)}
                                    onKeyDown={(event) => {
                                        if (event.target === event.currentTarget && favorite && (event.key === 'Enter' || event.key === ' ')) {
                                            event.preventDefault()
                                            navigate(`/favorites/${favorite.id}`)
                                        }
                                    }}
                                    role={favorite ? 'button' : undefined}
                                    tabIndex={favorite ? 0 : undefined}
                                >
                                    <div className={[styles.typeIcon, styles[placeType]].join(' ')} aria-hidden="true">
                                        {placeType === 'home' ? '⌂' : '▦'}
                                    </div>
                                    <div className={styles.frequentInfo}>
                                        <span>{favorite ? getFavoriteName(favorite) : PLACE_TYPE_LABELS[placeType]}</span>
                                        <strong>{favorite?.placeName || '등록된 장소 없음'}</strong>
                                        {favorite && <small>{favorite.address}</small>}
                                    </div>
                                    {favorite ? (
                                        <div className={styles.frequentActions}>
                                            <button type="button" className={styles.routeAction} onClick={(event) => { event.stopPropagation(); handleFindRoute(favorite) }}>➤ 경로 찾기</button>
                                        </div>
                                    ) : (
                                        <button type="button" className={styles.textAction} onClick={() => openSaveModal(placeType)}>등록</button>
                                    )}
                                </article>
                            )
                        })}
                    </div>
                </section>

                <div className={styles.sectionHeading}>
                    <h2>즐겨찾기 목록</h2>
                    <button type="button" className={styles.saveButton} onClick={() => openSaveModal()}>+ 저장</button>
                </div>

                {loading && <p className={styles.message}>즐겨찾기를 불러오는 중입니다.</p>}
                {!loading && error && <p className={styles.error}>{error}</p>}
                {!loading && !error && favorites.filter((favorite) => favorite.placeType === 'custom').length === 0 && (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon} aria-hidden="true">♡</div>
                        <strong>저장한 장소가 없습니다</strong>
                        <p>자주 가는 장소를 저장하면<br />더 빠르게 경로를 찾을 수 있어요.</p>
                    </div>
                )}
                {!loading && !error && favorites.filter((favorite) => favorite.placeType === 'custom').length > 0 && (
                    <div className={styles.list}>
                        {favorites.filter((favorite) => favorite.placeType === 'custom').map((favorite) => (
                            <article
                                className={[styles.item, styles.clickable].join(' ')}
                                key={favorite.id}
                                onClick={() => navigate(`/favorites/${favorite.id}`)}
                                onKeyDown={(event) => {
                                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault()
                                        navigate(`/favorites/${favorite.id}`)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className={[styles.typeIcon, styles[favorite.placeType]].join(' ')} aria-hidden="true">
                                    {favorite.placeType === 'home' ? '⌂' : favorite.placeType === 'work' ? '▦' : '♡'}
                                </div>
                                <div className={styles.itemInfo}>
                                    <strong>{getFavoriteName(favorite)}</strong>
                                    <span>{favorite.placeName}</span>
                                    <span>{favorite.address}</span>
                                </div>
                                <div className={styles.itemActions}>
                                    <button type="button" className={styles.routeAction} onClick={(event) => { event.stopPropagation(); handleFindRoute(favorite) }}>➤ 경로 찾기</button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); openEditModal(favorite) }}>수정</button>
                                    <button type="button" className={styles.deleteAction} onClick={(event) => { event.stopPropagation(); setDeletingFavorite(favorite) }}>삭제</button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>
            <BottomNav />

            <Modal
                open={Boolean(deletingFavorite)}
                icon="warning"
                title="즐겨찾기 삭제"
                description="저장한 장소를 삭제하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setDeletingFavorite(null)}
                confirmLabel={submitting ? '삭제 중...' : '삭제'}
                onConfirm={handleDelete}
                pending={submitting}
                danger
            />
            <Modal
                open={deleteComplete}
                icon="success"
                title="삭제 완료"
                description="즐겨찾기가 삭제되었습니다."
                confirmLabel="확인"
                onConfirm={() => setDeleteComplete(false)}
            />

            {saving && (
                <div className={styles.editBackdrop} role="presentation" onClick={() => setSaving(false)}>
                    <div className={styles.editModal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <h2>즐겨찾기 저장</h2>
                        <p>장소명과 주소는 고정이며, 즐겨찾기 이름만 변경할 수 있어요.</p>
                        <div className={styles.typeChoices}>
                            {Object.entries(PLACE_TYPE_LABELS).map(([value, label]) => (
                                <button
                                    type="button"
                                    key={value}
                                    className={[
                                        saveForm.placeType === value ? styles.selectedType : '',
                                        value !== 'custom' && favorites.some((favorite) => favorite.placeType === value) ? styles.disabledType : '',
                                    ].filter(Boolean).join(' ')}
                                    disabled={value !== 'custom' && favorites.some((favorite) => favorite.placeType === value)}
                                    onClick={() => setSaveForm((current) => ({ ...current, placeType: value }))}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Input label="즐겨찾기 이름" value={saveForm.customName} onChange={(event) => setSaveForm((current) => ({ ...current, customName: event.target.value }))} maxLength={100} placeholder={PLACE_TYPE_LABELS[saveForm.placeType]} />
                        <Input label="장소명" value={saveForm.placeName} readOnly />
                        <Input label="주소" value={saveForm.address} readOnly />
                        <button type="button" className={styles.textAction} onClick={() => openSaveModal(saveForm.placeType)} disabled={submitting}>지도에서 위치 다시 선택</button>
                        {saveError && <p role="alert">{saveError}</p>}
                        <div className={styles.editActions}>
                            <Button variant="secondary" size="sm" onClick={() => setSaving(false)}>취소</Button>
                            <Button size="sm" onClick={handleSave} disabled={!hasSelectedLocation(saveForm) || submitting || loading}>
                                {submitting ? '저장 중...' : '저장'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default FavoritesPage
