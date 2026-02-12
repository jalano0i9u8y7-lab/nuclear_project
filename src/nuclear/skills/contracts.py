from typing import Protocol, Dict, Any, runtime_checkable

@runtime_checkable
class Skill(Protocol):
    """
    Protocol for executable Skills.
    Skills are units of logic that can be dynamically bound to phases.
    """
    id: str
    version: str

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the skill logic against the given context.
        The context commonly contains 'input', 'payload', and other runtime data.
        Returns the modified context (or payload part) depending on phase contract.
        """
        ...

@runtime_checkable
class SchemaSkill(Skill, Protocol):
    """
    A Skill that also provides a JSON schema for validation.
    """
    def get_schema(self) -> Dict[str, Any]:
        """
        Return the JSON schema definition for the output produced by this skill.
        """
        ...
