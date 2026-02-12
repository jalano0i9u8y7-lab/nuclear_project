
"""
Runtime Binding Logic (M51).
Resolves phase -> [Skill] list using the loader.
"""
from typing import List
from nuclear.skills.contracts import Skill
from nuclear.skills.loader import load_registry, load_skill_instance
import structlog

log = structlog.get_logger()

def get_skills_for_phase(phase: str) -> List[Skill]:
    """
    Return list of executable Skill instances bound to this phase.
    """
    reg = load_registry()
    phase_map = reg.get("phase_map", {})
    
    phase_lower = phase.lower()
    if phase_lower not in phase_map:
        return []
        
    skill_ids = phase_map[phase_lower]
    skills = []
    
    for sid in skill_ids:
        try:
            skill = load_skill_instance(sid)
            skills.append(skill)
        except ValueError:
            # Skill might not be code-backed (content only), which is fine for now
            # We skip content-only skills in runtime binding unless they implement the protocol
            pass
        except Exception as e:
            log.warn("skill_runtime_bind_failed", skill_id=sid, error=str(e))
            
    return skills

def get_bound_skill_versions(phase: str) -> dict[str, str]:
    """
    Return mapped versions of skills bound to a phase.
    Useful for snapshot metadata.
    """
    skills = get_skills_for_phase(phase)
    return {s.id: s.version for s in skills}
