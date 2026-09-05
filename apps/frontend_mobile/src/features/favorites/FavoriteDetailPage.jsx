import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Input, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { deleteFavorite, getFavorites, updateFavorite } from './api.js'
import styles from './FavoritesPage.module.css'

const PLACE_TYPE_LABELS = {
    home: '집',
    work: '회사',
    custom: '저장 장소',
}

function FavoriteDetailPage() {
    const navigate = useNavigate()
    const { favoriteId } = useParams()
    const [favorite, setFavorite] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        let active = true

        getFavorites()
            .then((favorites) => {
                const found = favorites?.find((item) => item.id === favoriteId)
                if (!found) throw new Error('즐겨찾기를 찾을 수 없습니다')
                if (active) {
                    setFavorite(found)
                    setName(found.custom_name || found.place_name)
                    setAddress(found.address)
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
    }, [favoriteId])

    const handleSave = async () => {
        if (!favorite || !name.trim() || !address.trim() || submitting) return

        setSubmitting(true)
        try {
            await updateFavorite(favorite.id, { customName: name.trim(), address: address.trim() })
            navigate('/favorites', { replace: true })
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!favorite || submitting) return

        setSubmitting(true)
        try {
            await deleteFavorite(favorite.id)
            navigate('/favorites', { replace: true })
        } catch (requestError) {
            setError(requestError.message)
            setSubmitting(false)
        }
    }

    if (loading) return <p className={styles.message}>즐겨찾기를 불러오는 중입니다.</p>
    if (error || !favorite) {
        return (
            <div className={styles.page}>
                <Header title="즐겨찾기 상세" onBack={() => navigate('/favorites')} />
                <p className={styles.error}>{error || '즐겨찾기를 찾을 수 없습니다'}</p>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <Header title="즐겨찾기 상세" onBack={() => navigate('/favorites')} />
            <main className={styles.detailContent}>
                <div className={[styles.detailIcon, styles[favorite.place_type]].join(' ')} aria-hidden="true">
                    {favorite.place_type === 'home' ? '⌂' : favorite.place_type === 'work' ? '▦' : '♡'}
                </div>
                <span className={styles.detailType}>{PLACE_TYPE_LABELS[favorite.place_type]}</span>
                <div className={styles.detailForm}>
                    <Input label="즐겨찾기 이름" value={name} onChange={(event) => setName(event.target.value)} placeholder="즐겨찾기 이름을 입력해주세요" />
                    <Input label="주소" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="주소를 입력해주세요" />
                </div>

                <div className={styles.detailActions}>
                    <Button fullWidth onClick={handleSave} disabled={!name.trim() || !address.trim() || submitting}>
                        {submitting ? '저장 중...' : '변경사항 저장'}
                    </Button>
                    <Button fullWidth variant="danger" onClick={() => setDeleting(true)}>삭제</Button>
                </div>
            </main>

            <Modal
                open={deleting}
                icon="warning"
                title="즐겨찾기 삭제"
                description="저장한 장소를 삭제하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setDeleting(false)}
                confirmLabel={submitting ? '삭제 중...' : '삭제'}
                onConfirm={handleDelete}
                danger
            />

        </div>
    )
}

export default FavoriteDetailPage
