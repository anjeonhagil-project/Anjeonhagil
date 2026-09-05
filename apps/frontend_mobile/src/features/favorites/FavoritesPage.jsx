import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { createFavorite, deleteFavorite, getFavorites, updateFavorite } from './api.js'
import styles from './FavoritesPage.module.css'

const PLACE_TYPE_LABELS = {
    home: '집',
    work: '회사',
    custom: '저장 장소',
}

function FavoritesPage() {
    const navigate = useNavigate()
    const { session, loading: authLoading } = useAuth()
    const [favorites, setFavorites] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingFavorite, setEditingFavorite] = useState(null)
    const [editingName, setEditingName] = useState('')
    const [deletingFavorite, setDeletingFavorite] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saveForm, setSaveForm] = useState({ placeType: 'custom', placeName: '', customName: '', address: '' })
    const [submitting, setSubmitting] = useState(false)

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
        setSaveForm({ placeType, placeName: '', customName: '', address: '' })
        setSaving(true)
    }

    const handleSave = async () => {
        if (!saveForm.placeName.trim() || !saveForm.address.trim() || submitting) return

        setSubmitting(true)
        try {
            const created = await createFavorite({
                ...saveForm,
                longitude: 127.0276,
                latitude: 37.4979,
            })
            setFavorites((current) => [...current, created])
            setSaving(false)
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleFindRoute = () => {
        navigate('/home')
    }

    const openEditModal = (favorite) => {
        setEditingFavorite(favorite)
        setEditingName(favorite.custom_name || favorite.place_name)
    }

    const handleEdit = async () => {
        if (!editingFavorite || !editingName.trim() || submitting) return

        setSubmitting(true)
        try {
            const updated = await updateFavorite(editingFavorite.id, { customName: editingName.trim() })
            setFavorites((current) => current.map((favorite) => favorite.id === updated.id ? updated : favorite))
            setEditingFavorite(null)
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deletingFavorite || submitting) return

        setSubmitting(true)
        try {
            await deleteFavorite(deletingFavorite.id)
            setFavorites((current) => current.filter((favorite) => favorite.id !== deletingFavorite.id))
            setDeletingFavorite(null)
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.page}>
            <Header title="즐겨찾기" onBack={() => window.history.back()} />
            <main className={styles.content}>
                <section className={styles.frequentSection}>
                    <h2>자주 가는 곳</h2>
                    <div className={styles.frequentList}>
                        {['home', 'work'].map((placeType) => {
                            const favorite = favorites.find((item) => item.place_type === placeType)
                            return (
                                <article
                                    className={[styles.frequentItem, favorite ? styles.clickable : ''].filter(Boolean).join(' ')}
                                    key={placeType}
                                    onClick={() => favorite && navigate(`/favorites/${favorite.id}`)}
                                    onKeyDown={(event) => {
                                        if (favorite && (event.key === 'Enter' || event.key === ' ')) navigate(`/favorites/${favorite.id}`)
                                    }}
                                    role={favorite ? 'button' : undefined}
                                    tabIndex={favorite ? 0 : undefined}
                                >
                                    <div className={[styles.typeIcon, styles[placeType]].join(' ')} aria-hidden="true">
                                        {placeType === 'home' ? '⌂' : '▦'}
                                    </div>
                                    <div className={styles.frequentInfo}>
                                        <span>{PLACE_TYPE_LABELS[placeType]}</span>
                                        <strong>{favorite?.custom_name || favorite?.place_name || '등록된 장소 없음'}</strong>
                                        {favorite && <small>{favorite.address}</small>}
                                    </div>
                                    {favorite ? (
                                        <button type="button" className={styles.routeAction} onClick={(event) => { event.stopPropagation(); handleFindRoute(favorite) }}>➤ 경로 찾기</button>
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
                {!loading && !error && favorites.filter((favorite) => favorite.place_type === 'custom').length === 0 && (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon} aria-hidden="true">♡</div>
                        <strong>저장한 장소가 없습니다</strong>
                        <p>자주 가는 장소를 저장하면<br />더 빠르게 경로를 찾을 수 있어요.</p>
                    </div>
                )}
                {!loading && !error && favorites.filter((favorite) => favorite.place_type === 'custom').length > 0 && (
                    <div className={styles.list}>
                        {favorites.filter((favorite) => favorite.place_type === 'custom').map((favorite) => (
                            <article className={styles.item} key={favorite.id}>
                                <div className={[styles.typeIcon, styles[favorite.place_type]].join(' ')} aria-hidden="true">
                                    {favorite.place_type === 'home' ? '⌂' : favorite.place_type === 'work' ? '▦' : '♡'}
                                </div>
                                <div className={styles.itemInfo}>
                                    <span className={styles.type}>{PLACE_TYPE_LABELS[favorite.place_type]}</span>
                                    <strong>{favorite.custom_name || favorite.place_name}</strong>
                                    <span>{favorite.address}</span>
                                </div>
                                <div className={styles.itemActions}>
                                    <button type="button" className={styles.routeAction} onClick={() => handleFindRoute(favorite)}>➤ 경로 찾기</button>
                                    <button type="button" onClick={() => openEditModal(favorite)}>이름 변경</button>
                                    <button type="button" className={styles.deleteAction} onClick={() => setDeletingFavorite(favorite)}>삭제</button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            <Modal
                open={Boolean(deletingFavorite)}
                icon="warning"
                title="즐겨찾기 삭제"
                description="저장한 장소를 삭제하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setDeletingFavorite(null)}
                confirmLabel={submitting ? '삭제 중...' : '삭제'}
                onConfirm={handleDelete}
                danger
            />

            {editingFavorite && (
                <div className={styles.editBackdrop} role="presentation" onClick={() => setEditingFavorite(null)}>
                    <div className={styles.editModal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <h2>즐겨찾기 이름 변경</h2>
                        <p>{editingFavorite.address}</p>
                        <Input label="새 이름" value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="장소 이름을 입력해주세요" />
                        <div className={styles.editActions}>
                            <Button variant="secondary" size="sm" onClick={() => setEditingFavorite(null)}>취소</Button>
                            <Button size="sm" onClick={handleEdit} disabled={!editingName.trim() || submitting}>
                                {submitting ? '변경 중...' : '변경'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {saving && (
                <div className={styles.editBackdrop} role="presentation" onClick={() => setSaving(false)}>
                    <div className={styles.editModal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <h2>즐겨찾기 저장</h2>
                        <p>자주 가는 장소를 저장해보세요.</p>
                        <div className={styles.typeChoices}>
                            {Object.entries(PLACE_TYPE_LABELS).map(([value, label]) => (
                                <button
                                    type="button"
                                    key={value}
                                    className={[
                                        saveForm.placeType === value ? styles.selectedType : '',
                                        value !== 'custom' && favorites.some((favorite) => favorite.place_type === value) ? styles.disabledType : '',
                                    ].filter(Boolean).join(' ')}
                                    disabled={value !== 'custom' && favorites.some((favorite) => favorite.place_type === value)}
                                    onClick={() => setSaveForm((current) => ({ ...current, placeType: value }))}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Input label="장소명" value={saveForm.placeName} onChange={(event) => setSaveForm((current) => ({ ...current, placeName: event.target.value }))} placeholder="장소명을 입력해주세요" />
                        <Input label="주소" value={saveForm.address} onChange={(event) => setSaveForm((current) => ({ ...current, address: event.target.value }))} placeholder="주소를 입력해주세요" />
                        <Input label="별칭" value={saveForm.customName} onChange={(event) => setSaveForm((current) => ({ ...current, customName: event.target.value }))} placeholder="예: 우리 집" />
                        <div className={styles.editActions}>
                            <Button variant="secondary" size="sm" onClick={() => setSaving(false)}>취소</Button>
                            <Button size="sm" onClick={handleSave} disabled={!saveForm.placeName.trim() || !saveForm.address.trim() || submitting}>
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